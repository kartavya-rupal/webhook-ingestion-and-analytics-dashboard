import { Router } from 'express';
import { db } from '@finrelay/db';
import { requireActor } from '../lib/authz';
import { resolveAnalyticsTenantScope } from '../lib/analytics-boundaries';
import { queryClickHouse, sqlQuote } from '../lib/clickhouse';
import { runAnalyticsAggregationJob } from '../lib/analytics-job';

// type AnalyticsQueryValue = string | undefined;

type AnalyticsBounds = {
    fromIso: string;
    toIso: string;
};

function getQueryString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function parseDate(value: unknown): Date | null {
    const raw = getQueryString(value);
    if (!raw) return null;

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getWindowMs(range: string): number {
    switch (range) {
        case '24h':
            return 24 * 60 * 60 * 1000;
        case '7d':
            return 7 * 24 * 60 * 60 * 1000;
        case '30d':
            return 30 * 24 * 60 * 60 * 1000;
        case '90d':
            return 90 * 24 * 60 * 60 * 1000;
        default:
            return 7 * 24 * 60 * 60 * 1000;
    }
}

function getBounds(query: Record<string, unknown>): AnalyticsBounds {
    const to = parseDate(query.to) ?? new Date();

    const explicitFrom = parseDate(query.from);
    const range = getQueryString(query.range) ?? '7d';

    const from =
        explicitFrom ?? new Date(to.getTime() - getWindowMs(range));

    return {
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
    };
}

function buildWhereClause(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
        eventType?: string;
        status?: string;
    } = {},
): string {
    const clauses = [
        `bucket_start_utc >= parseDateTimeBestEffort(${sqlQuote(bounds.fromIso)})`,
        `bucket_start_utc <= parseDateTimeBestEffort(${sqlQuote(bounds.toIso)})`,
    ];

    if (filters.tenantId) {
        clauses.push(`tenant_id = ${sqlQuote(filters.tenantId)}`);
    }

    if (filters.endpointId) {
        clauses.push(`endpoint_id = ${sqlQuote(filters.endpointId)}`);
    }

    if (filters.providerSlug) {
        clauses.push(`provider_slug = ${sqlQuote(filters.providerSlug)}`);
    }

    if (filters.eventType) {
        clauses.push(`event_type = ${sqlQuote(filters.eventType)}`);
    }

    if (filters.eventType) {
        clauses.push(`event_type = ${sqlQuote(filters.eventType)}`);
    }

    if (filters.status) {
        clauses.push(`status = ${sqlQuote(filters.status)}`);
    }

    return clauses.join(' AND ');
}

function toNumber(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

function withRates(summary: {
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    dlqEvents: number;
    replayRequests: number;
    replaySucceeded: number;
    replayFailed: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
}) {
    const total = summary.totalEvents || 0;
    const replayTotal = summary.replayRequests || 0;

    return {
        ...summary,
        successRate: total ? summary.succeededEvents / total : 0,
        failureRate:
            total
                ? (summary.retryableFailures +
                    summary.nonRetryableFailures +
                    summary.dlqEvents) /
                total
                : 0,
        retryRate: total ? summary.retryableFailures / total : 0,
        dlqRate: total ? summary.dlqEvents / total : 0,
        replaySuccessRate:
            replayTotal ? summary.replaySucceeded / replayTotal : 0,
    };
}

async function getSummary(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
    } = {},
) {
    const [eventRows, replayRows] = await Promise.all([
        queryClickHouse<{
            totalEvents: number;
            succeededEvents: number;
            retryableFailures: number;
            nonRetryableFailures: number;
            dlqEvents: number;
            replayRequests: number;
            replaySucceeded: number;
            replayFailed: number;
            avgLatencyMs: number;
            p95LatencyMs: number;
            p99LatencyMs: number;
        }>(`
      SELECT
        sum(total_events) AS totalEvents,
        sum(succeeded_events) AS succeededEvents,
        sum(retryable_failures) AS retryableFailures,
        sum(non_retryable_failures) AS nonRetryableFailures,
        sum(dlq_events) AS dlqEvents,
        sum(replay_requests) AS replayRequests,
        sum(replay_succeeded) AS replaySucceeded,
        sum(replay_failed) AS replayFailed,
        sum(avg_latency_ms * total_events) / nullIf(sum(total_events), 0) AS avgLatencyMs,
        max(p95_latency_ms) AS p95LatencyMs,
        max(p99_latency_ms) AS p99LatencyMs
      FROM hourly_event_trends
      WHERE ${buildWhereClause(bounds, filters)}
    `),
        queryClickHouse<{
            replayJobs: number;
            replaySucceeded: number;
            replayFailed: number;
        }>(`
      SELECT
        sum(total_replay_jobs) AS replayJobs,
        sum(replay_succeeded) AS replaySucceeded,
        sum(replay_failed) AS replayFailed
      FROM daily_replay_summary
      WHERE ${buildWhereClause(bounds, filters)}
    `),
    ]);

    const eventRow = eventRows[0] ?? {
        totalEvents: 0,
        succeededEvents: 0,
        retryableFailures: 0,
        nonRetryableFailures: 0,
        dlqEvents: 0,
        replayRequests: 0,
        replaySucceeded: 0,
        replayFailed: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
    };

    const replayRow = replayRows[0] ?? {
        replayJobs: 0,
        replaySucceeded: 0,
        replayFailed: 0,
    };

    return withRates({
        totalEvents: toNumber(eventRow.totalEvents),
        succeededEvents: toNumber(eventRow.succeededEvents),
        retryableFailures: toNumber(eventRow.retryableFailures),
        nonRetryableFailures: toNumber(eventRow.nonRetryableFailures),
        dlqEvents: toNumber(eventRow.dlqEvents),
        replayRequests: toNumber(eventRow.replayRequests || replayRow.replayJobs),
        replaySucceeded: toNumber(eventRow.replaySucceeded || replayRow.replaySucceeded),
        replayFailed: toNumber(eventRow.replayFailed || replayRow.replayFailed),
        avgLatencyMs: toNumber(eventRow.avgLatencyMs),
        p95LatencyMs: toNumber(eventRow.p95LatencyMs),
        p99LatencyMs: toNumber(eventRow.p99LatencyMs),
    });
}

async function getTrends(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
    } = {},
) {
    const rows = await queryClickHouse<{
        bucketStartUtc: string;
        totalEvents: number;
        succeededEvents: number;
        retryableFailures: number;
        nonRetryableFailures: number;
        dlqEvents: number;
        replayRequests: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        p99LatencyMs: number;
    }>(`
    SELECT
      toString(bucket_start_utc) AS bucketStartUtc,
      sum(total_events) AS totalEvents,
      sum(succeeded_events) AS succeededEvents,
      sum(retryable_failures) AS retryableFailures,
      sum(non_retryable_failures) AS nonRetryableFailures,
      sum(dlq_events) AS dlqEvents,
      sum(replay_requests) AS replayRequests,
      sum(avg_latency_ms * total_events) / nullIf(sum(total_events), 0) AS avgLatencyMs,
      max(p95_latency_ms) AS p95LatencyMs,
      max(p99_latency_ms) AS p99LatencyMs
    FROM hourly_event_trends
    WHERE ${buildWhereClause(bounds, filters)}
    GROUP BY bucket_start_utc
    ORDER BY bucket_start_utc ASC
  `);

    return rows.map((row) => ({
        bucketStartUtc: row.bucketStartUtc,
        totalEvents: toNumber(row.totalEvents),
        succeededEvents: toNumber(row.succeededEvents),
        retryableFailures: toNumber(row.retryableFailures),
        nonRetryableFailures: toNumber(row.nonRetryableFailures),
        dlqEvents: toNumber(row.dlqEvents),
        replayRequests: toNumber(row.replayRequests),
        avgLatencyMs: toNumber(row.avgLatencyMs),
        p95LatencyMs: toNumber(row.p95LatencyMs),
        p99LatencyMs: toNumber(row.p99LatencyMs),
    }));
}

async function getEndpointLeaderboard(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
    } = {},
) {
    const rows = await queryClickHouse<{
        endpointId: string;
        totalEvents: number;
        succeededEvents: number;
        retryableFailures: number;
        nonRetryableFailures: number;
        dlqEvents: number;
        retryCount: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        p99LatencyMs: number;
    }>(`
    SELECT
      endpoint_id AS endpointId,
      sum(total_events) AS totalEvents,
      sum(succeeded_events) AS succeededEvents,
      sum(retryable_failures) AS retryableFailures,
      sum(non_retryable_failures) AS nonRetryableFailures,
      sum(dlq_events) AS dlqEvents,
      sum(retry_count) AS retryCount,
      sum(avg_latency_ms * total_events) / nullIf(sum(total_events), 0) AS avgLatencyMs,
      max(p95_latency_ms) AS p95LatencyMs,
      max(p99_latency_ms) AS p99LatencyMs
    FROM hourly_endpoint_performance
    WHERE ${buildWhereClause(bounds, filters)}
    GROUP BY endpoint_id
    ORDER BY (retryableFailures + nonRetryableFailures + dlqEvents) DESC
    LIMIT 10
  `);

    const endpointIds = rows.map((row) => row.endpointId);
    const endpoints = endpointIds.length
        ? await db.endpoint.findMany({
            where: { id: { in: endpointIds } },
            select: {
                id: true,
                name: true,
                providerSlug: true,
                tenantId: true,
            },
        })
        : [];

    const endpointMap = new Map(
        endpoints.map((endpoint) => [
            endpoint.id,
            {
                name: endpoint.name,
                providerSlug: endpoint.providerSlug,
            },
        ]),
    );

    return rows.map((row) => {
        const meta = endpointMap.get(row.endpointId);

        const totalEvents = toNumber(row.totalEvents);
        const failures =
            toNumber(row.retryableFailures) +
            toNumber(row.nonRetryableFailures) +
            toNumber(row.dlqEvents);

        return {
            endpointId: row.endpointId,
            endpointName: meta?.name ?? row.endpointId,
            providerSlug: meta?.providerSlug ?? 'unknown',
            totalEvents,
            succeededEvents: toNumber(row.succeededEvents),
            retryableFailures: toNumber(row.retryableFailures),
            nonRetryableFailures: toNumber(row.nonRetryableFailures),
            dlqEvents: toNumber(row.dlqEvents),
            retryCount: toNumber(row.retryCount),
            avgLatencyMs: toNumber(row.avgLatencyMs),
            p95LatencyMs: toNumber(row.p95LatencyMs),
            p99LatencyMs: toNumber(row.p99LatencyMs),
            failureRate: totalEvents ? failures / totalEvents : 0,
        };
    });
}

async function getEventTypeLeaderboard(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
    } = {},
) {
    const rows = await queryClickHouse<{
        eventType: string;
        totalEvents: number;
        succeededEvents: number;
        retryableFailures: number;
        nonRetryableFailures: number;
        dlqEvents: number;
        retryCount: number;
        replayRequests: number;
        avgLatencyMs: number;
        p95LatencyMs: number;
        p99LatencyMs: number;
    }>(`
    SELECT
      event_type AS eventType,
      sum(total_events) AS totalEvents,
      sum(succeeded_events) AS succeededEvents,
      sum(retryable_failures) AS retryableFailures,
      sum(non_retryable_failures) AS nonRetryableFailures,
      sum(dlq_events) AS dlqEvents,
      sum(retry_count) AS retryCount,
      sum(replay_requests) AS replayRequests,
      sum(avg_latency_ms * total_events) / nullIf(sum(total_events), 0) AS avgLatencyMs,
      max(p95_latency_ms) AS p95LatencyMs,
      max(p99_latency_ms) AS p99LatencyMs
    FROM hourly_event_type_performance
    WHERE ${buildWhereClause(bounds, filters)}
    GROUP BY event_type
    ORDER BY (retryableFailures + nonRetryableFailures + dlqEvents) DESC
    LIMIT 10
  `);

    return rows.map((row) => {
        const totalEvents = toNumber(row.totalEvents);
        const failures =
            toNumber(row.retryableFailures) +
            toNumber(row.nonRetryableFailures) +
            toNumber(row.dlqEvents);

        return {
            eventType: row.eventType,
            totalEvents,
            succeededEvents: toNumber(row.succeededEvents),
            retryableFailures: toNumber(row.retryableFailures),
            nonRetryableFailures: toNumber(row.nonRetryableFailures),
            dlqEvents: toNumber(row.dlqEvents),
            retryCount: toNumber(row.retryCount),
            replayRequests: toNumber(row.replayRequests),
            avgLatencyMs: toNumber(row.avgLatencyMs),
            p95LatencyMs: toNumber(row.p95LatencyMs),
            p99LatencyMs: toNumber(row.p99LatencyMs),
            failureRate: totalEvents ? failures / totalEvents : 0,
        };
    });
}

async function getReplaySeries(
    bounds: AnalyticsBounds,
    filters: {
        tenantId?: string;
        endpointId?: string;
        providerSlug?: string;
    } = {},
) {
    const rows = await queryClickHouse<{
        bucketStartUtc: string;
        totalReplayJobs: number;
        replayRequested: number;
        replayProcessing: number;
        replaySucceeded: number;
        replayFailed: number;
        replayLatencyMs: number;
    }>(`
    SELECT
      toString(bucket_start_utc) AS bucketStartUtc,
      sum(total_replay_jobs) AS totalReplayJobs,
      sum(replay_requested) AS replayRequested,
      sum(replay_processing) AS replayProcessing,
      sum(replay_succeeded) AS replaySucceeded,
      sum(replay_failed) AS replayFailed,
      sum(replay_latency_ms) AS replayLatencyMs
    FROM daily_replay_summary
    WHERE ${buildWhereClause(bounds, filters)}
    GROUP BY bucket_start_utc
    ORDER BY bucket_start_utc ASC
  `);

    return rows.map((row) => ({
        bucketStartUtc: row.bucketStartUtc,
        totalReplayJobs: toNumber(row.totalReplayJobs),
        replayRequested: toNumber(row.replayRequested),
        replayProcessing: toNumber(row.replayProcessing),
        replaySucceeded: toNumber(row.replaySucceeded),
        replayFailed: toNumber(row.replayFailed),
        replayLatencyMs: toNumber(row.replayLatencyMs),
    }));
}

function getFilters(
    query: Record<string, unknown>,
    tenantId?: string | null,
) {
    return {
        tenantId: tenantId ?? getQueryString(query.tenantId),
        endpointId: getQueryString(query.endpointId),
        providerSlug: getQueryString(query.providerSlug),
        eventType: getQueryString(query.eventType),
        status: getQueryString(query.status),
    };
}

export const analyticsRouter = Router();

analyticsRouter.post('/run', async (req, res) => {
    try {
        const actor = requireActor(req);
        const windowMinutes =
            typeof req.body?.windowMinutes === 'number' ? req.body.windowMinutes : 60;
        const requestedTenantId =
            typeof req.body?.tenantId === 'string' ? req.body.tenantId : null;
        const tenantId = resolveAnalyticsTenantScope(actor, requestedTenantId);

        const summary = await runAnalyticsAggregationJob({
            jobName: 'analytics.summary',
            tenantId,
            windowMinutes,
            requestId:
                typeof req.body?.requestId === 'string' ? req.body.requestId : null,
        });

        return res.status(200).json({
            status: 'ok',
            summary,
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Analytics job failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/summary', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));
        const summary = await getSummary(bounds, filters);
        res.json({ summary, bounds });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load analytics summary',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/trends', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));
        const trends = await getTrends(bounds, filters);
        res.json({ items: trends, bounds });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load analytics trends',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/endpoints', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));
        const items = await getEndpointLeaderboard(bounds, filters);
        res.json({ items, bounds });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load endpoint analytics',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/event-types', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));
        const items = await getEventTypeLeaderboard(bounds, filters);
        res.json({ items, bounds });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load event type analytics',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/replays', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));
        const items = await getReplaySeries(bounds, filters);
        res.json({ items, bounds });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load replay analytics',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

analyticsRouter.get('/overview', async (req, res) => {
    try {
        const actor = requireActor(req);
        const bounds = getBounds(req.query as Record<string, unknown>);
        const filters = getFilters(req.query as Record<string, unknown>, resolveAnalyticsTenantScope(actor, getQueryString(req.query.tenantId)));

        const [summary, trends, endpoints, eventTypes, replays] = await Promise.all([
            getSummary(bounds, filters),
            getTrends(bounds, filters),
            getEndpointLeaderboard(bounds, filters),
            getEventTypeLeaderboard(bounds, filters),
            getReplaySeries(bounds, filters),
        ]);

        res.json({
            summary,
            trends,
            endpoints,
            eventTypes,
            replays,
            bounds,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load analytics overview',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});