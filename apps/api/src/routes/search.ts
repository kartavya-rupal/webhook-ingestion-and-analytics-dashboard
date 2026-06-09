import { Router } from 'express';
import { db } from '@finrelay/db';
import { requireActor } from '../lib/authz';
import { assertSensitiveSearchAccess, resolveSearchTenantScope } from '../lib/search-boundaries';
import { backfillSearchIndex, indexEventForSearch } from '../lib/search-index';
import { recordSearchIndexOutcome } from '../lib/telemetry';

type SearchSort = 'newest' | 'oldest' | 'relevance';
type TimeRangePreset = '15m' | '1h' | 'today' | 'yesterday' | '7d' | 'custom';

type SearchQuery = {
    q?: string;
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    status?: string;
    range?: TimeRangePreset;
    from?: string;
    to?: string;
    limit?: string | number;
    offset?: string | number;
    sort?: string;
};

type SearchPage<T> = {
    items: T[];
    page: {
        limit: number;
        offset: number;
        total: number;
    };
};

type SearchEventItem = {
    id: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    status: string;
    receivedAt: Date;
    processedAt: Date | null;
    lastUpdatedAt: Date;
    replayCount: number;
    attemptCount: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    dedupeKey: string;
    payloadPath: string;
    payloadHash: string;
    requestIp: string | null;
};

type SearchAttemptItem = {
    id: string;
    eventId: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    attemptNumber: number;
    status: string;
    failureCategory: string | null;
    responseCode: number | null;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    nextRetryAt: Date | null;
    workerName: string | null;
    createdAt: Date;
    eventType: string;
    externalEventId: string | null;
};

type SearchReplayItem = {
    id: string;
    eventId: string | null;
    tenantId: string;
    tenantName: string;
    endpointId: string | null;
    endpointName: string | null;
    providerSlug: string | null;
    eventType: string | null;
    requestedBy: string | null;
    replayStatus: string;
    createdAt: Date;
    finishedAt: Date | null;
};

type SearchLogItem = {
    id: string;
    timestamp: Date | string;
    service: 'api' | 'worker' | 'dashboard';
    level: 'info' | 'warn' | 'error';
    message: string;
    eventId: string | null;
    tenantId: string | null;
    tenantName: string | null;
    endpointId: string | null;
    endpointName: string | null;
    providerSlug: string | null;
    attemptNumber: number | null;
    replayJobId: string | null;
    errorMessage: string | null;
};

type SearchPayloadItem = {
    id: string;
    eventId: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    eventType: string;
    externalEventId: string | null;
    status: string;
    receivedAt: Date;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    payloadPreview: string;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
};

// type Ranked<T> = {
//     item: T;
//     score: number;
//     time: number;
//     id: string;
// };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_RANGE: TimeRangePreset = '7d';

function firstText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function parseLimit(value: unknown): number {
    const raw = Number.parseInt(firstText(value) ?? '', 10);

    if (!Number.isFinite(raw) || Number.isNaN(raw) || raw <= 0) {
        return DEFAULT_LIMIT;
    }

    return Math.min(raw, MAX_LIMIT);
}

function parseOffset(value: unknown): number {
    const raw = Number.parseInt(firstText(value) ?? '', 10);

    if (!Number.isFinite(raw) || Number.isNaN(raw) || raw < 0) {
        return 0;
    }

    return raw;
}

function parseDate(value: unknown): Date | null {
    const raw = firstText(value);

    if (!raw) {
        return null;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSort(value: unknown): SearchSort {
    const raw = firstText(value);

    if (raw === 'oldest' || raw === 'relevance' || raw === 'newest') {
        return raw;
    }

    return 'newest';
}

function textContains(value: string) {
    return { contains: value, mode: 'insensitive' as const };
}

function getEventLastUpdatedAt(event: {
    processingFinishedAt: Date | null;
    processedAt: Date | null;
    dlqMovedAt: Date | null;
    nextRetryAt: Date | null;
    queuedAt: Date | null;
    signatureVerifiedAt: Date | null;
    receivedAt: Date;
}) {
    return (
        event.processingFinishedAt ??
        event.processedAt ??
        event.dlqMovedAt ??
        event.nextRetryAt ??
        event.queuedAt ??
        event.signatureVerifiedAt ??
        event.receivedAt
    );
}

function resolveBounds(query: SearchQuery): { from?: Date; to?: Date } {
    const explicitFrom = parseDate(query.from);
    const explicitTo = parseDate(query.to);

    if (explicitFrom || explicitTo) {
        return {
            from: explicitFrom ?? undefined,
            to: explicitTo ?? new Date(),
        };
    }

    const now = new Date();

    switch (query.range ?? DEFAULT_RANGE) {
        case '15m':
            return { from: new Date(now.getTime() - 15 * 60 * 1000), to: now };
        case '1h':
            return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
        case 'today':
            return {
                from: new Date(
                    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
                ),
                to: now,
            };
        case 'yesterday': {
            const end = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
            );
            return { from: new Date(end.getTime() - 24 * 60 * 60 * 1000), to: end };
        }
        case '7d':
        case 'custom':
        default:
            return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
    }
}

function buildBaseFilters(query: SearchQuery): {
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    status?: string;
} {
    return {
        tenantId: firstText(query.tenantId),
        endpointId: firstText(query.endpointId),
        providerSlug: firstText(query.providerSlug),
        status: firstText(query.status),
    };
}

function applyDateFilter(
    target: Record<string, unknown>,
    key: string,
    bounds: { from?: Date; to?: Date },
) {
    if (!bounds.from && !bounds.to) {
        return;
    }

    target[key] = {};

    if (bounds.from) {
        (target[key] as Record<string, unknown>).gte = bounds.from;
    }

    if (bounds.to) {
        (target[key] as Record<string, unknown>).lte = bounds.to;
    }
}

function buildEventWhere(query: SearchQuery): Record<string, unknown> {
    const where: Record<string, unknown> = {
        ...buildBaseFilters(query),
    };
    const q = firstText(query.q);
    const bounds = resolveBounds(query);

    applyDateFilter(where, 'receivedAt', bounds);

    if (q) {
        where.OR = [
            { id: textContains(q) },
            { externalEventId: textContains(q) },
            { eventType: textContains(q) },
            { providerSlug: textContains(q) },
            { dedupeKey: textContains(q) },
            { payloadPath: textContains(q) },
            { payloadHash: textContains(q) },
            { lastFailureReason: textContains(q) },
            { lastFailureCategory: textContains(q) },
            { requestIp: textContains(q) },
        ];
    }

    return where;
}

function buildAttemptWhere(query: SearchQuery): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const q = firstText(query.q);
    const bounds = resolveBounds(query);

    const eventFilter: Record<string, unknown> = {
        ...buildBaseFilters(query),
    };

    if (Object.keys(eventFilter).length > 0) {
        where.event = eventFilter;
    }

    applyDateFilter(where, 'createdAt', bounds);

    if (q) {
        const numericQ = Number.parseInt(q, 10);
        const orClauses: Record<string, unknown>[] = [
            { id: textContains(q) },
            { errorMessage: textContains(q) },
            { failureCategory: textContains(q) },
            { workerName: textContains(q) },
            { event: { id: textContains(q) } },
            { event: { eventType: textContains(q) } },
            { event: { externalEventId: textContains(q) } },
            { event: { dedupeKey: textContains(q) } },
            { event: { providerSlug: textContains(q) } },
        ];

        if (Number.isFinite(numericQ) && !Number.isNaN(numericQ)) {
            orClauses.push({ responseCode: numericQ });
            orClauses.push({ attemptNumber: numericQ });
        }

        where.OR = orClauses;
    }

    return where;
}

function buildReplayWhere(query: SearchQuery): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const q = firstText(query.q);
    const bounds = resolveBounds(query);

    if (firstText(query.tenantId)) {
        where.tenantId = firstText(query.tenantId);
    }

    if (firstText(query.status)) {
        where.replayStatus = firstText(query.status);
    }

    applyDateFilter(where, 'createdAt', bounds);

    if (q) {
        where.OR = [
            { id: textContains(q) },
            { eventId: textContains(q) },
            { requestedBy: textContains(q) },
            { replayStatus: textContains(q) },
            { event: { id: textContains(q) } },
            { event: { eventType: textContains(q) } },
            { event: { providerSlug: textContains(q) } },
        ];
    }

    return where;
}

function scoreTextMatch(haystack: string | null | undefined, query: string): number {
    if (!haystack) return 0;
    const text = haystack.toLowerCase();
    const q = query.toLowerCase();

    if (text === q) return 100;
    if (text.includes(q)) return 50;
    return 0;
}

function rankItems<T>(
    items: T[],
    options: {
        query?: string;
        sort: SearchSort;
        score: (item: T) => number;
        time: (item: T) => Date;
        id: (item: T) => string;
    },
): T[] {
    const useRelevance = Boolean(options.query) || options.sort === 'relevance';

    return [...items]
        .map((item) => ({
            item,
            score: options.score(item),
            time: options.time(item).getTime(),
            id: options.id(item),
        }))
        .sort((left, right) => {
            if (useRelevance && left.score !== right.score) {
                return right.score - left.score;
            }

            if (options.sort === 'oldest') {
                return left.time - right.time;
            }

            if (left.time !== right.time) {
                return right.time - left.time;
            }

            return left.id.localeCompare(right.id);
        })
        .map(({ item }) => item);
}

// function paginateAndRank<T>(
//     items: T[],
//     options: {
//         query?: string;
//         sort: SearchSort;
//         score: (item: T) => number;
//         time: (item: T) => Date;
//         id: (item: T) => string;
//     },
//     limit: number,
//     offset: number,
// ): { items: T[]; total: number } {
//     const ranked = rankItems(items, options);
//     return {
//         items: ranked.slice(offset, offset + limit),
//         total: ranked.length,
//     };
// }

function scoreEventResult(item: SearchEventItem, query?: string): number {
    let score = 0;

    if (query) {
        score += scoreTextMatch(item.id, query) * 4;
        score += scoreTextMatch(item.externalEventId, query) * 3;
        score += scoreTextMatch(item.eventType, query) * 3;
        score += scoreTextMatch(item.providerSlug, query) * 2;
        score += scoreTextMatch(item.dedupeKey, query) * 3;
        score += scoreTextMatch(item.payloadPath, query);
        score += scoreTextMatch(item.payloadHash, query);
        score += scoreTextMatch(item.lastFailureReason, query) * 3;
        score += scoreTextMatch(item.lastFailureCategory, query) * 3;
        score += scoreTextMatch(item.endpointName, query);
        score += scoreTextMatch(item.tenantName, query);
    }

    if (item.status.includes('failed') || item.status === 'moved_to_dlq' || item.status === 'replay_failed') {
        score += 20;
    }

    score += Math.min(item.replayCount, 5);
    score += Math.min(item.attemptCount, 5);

    return score;
}

function scoreAttemptResult(item: SearchAttemptItem, query?: string): number {
    let score = 0;

    if (query) {
        score += scoreTextMatch(item.id, query) * 4;
        score += scoreTextMatch(item.eventId, query) * 4;
        score += scoreTextMatch(item.eventType, query) * 4;
        score += scoreTextMatch(item.externalEventId, query) * 3;
        score += scoreTextMatch(item.errorMessage, query) * 3;
        score += scoreTextMatch(item.failureCategory, query) * 3;
        score += scoreTextMatch(item.workerName, query) * 2;
        score += scoreTextMatch(item.providerSlug, query) * 2;
    }

    if (item.status !== 'succeeded') {
        score += 15;
    }

    if (item.responseCode && item.responseCode >= 500) {
        score += 8;
    }

    score += Math.min(item.attemptNumber, 5);

    return score;
}

function scoreReplayResult(item: SearchReplayItem, query?: string): number {
    let score = 0;

    if (query) {
        score += scoreTextMatch(item.id, query) * 5;
        score += scoreTextMatch(item.eventId, query) * 4;
        score += scoreTextMatch(item.eventType, query) * 3;
        score += scoreTextMatch(item.requestedBy, query) * 2;
        score += scoreTextMatch(item.replayStatus, query) * 2;
        score += scoreTextMatch(item.providerSlug, query) * 2;
    }

    if (item.replayStatus === 'failed') {
        score += 15;
    }

    return score;
}

function scorePayloadResult(item: SearchPayloadItem, query?: string): number {
    let score = 0;

    if (query) {
        score += scoreTextMatch(item.id, query) * 4;
        score += scoreTextMatch(item.eventId, query) * 4;
        score += scoreTextMatch(item.eventType, query) * 3;
        score += scoreTextMatch(item.externalEventId, query) * 3;
        score += scoreTextMatch(item.payloadPreview, query) * 4;
        score += scoreTextMatch(item.dedupeKey, query) * 3;
        score += scoreTextMatch(item.lastFailureReason, query) * 3;
        score += scoreTextMatch(item.lastFailureCategory, query) * 3;
        score += scoreTextMatch(item.providerSlug, query) * 2;
        score += scoreTextMatch(item.endpointName, query);
        score += scoreTextMatch(item.tenantName, query);
    }

    return score;
}

function scoreLogResult(item: SearchLogItem, query?: string): number {
    let score = 0;

    if (query) {
        score += scoreTextMatch(item.id, query) * 2;
        score += scoreTextMatch(item.message, query) * 4;
        score += scoreTextMatch(item.errorMessage, query) * 3;
        score += scoreTextMatch(item.eventId, query) * 2;
        score += scoreTextMatch(item.providerSlug, query) * 2;
        score += scoreTextMatch(item.endpointName, query) * 2;
        score += scoreTextMatch(item.tenantName, query) * 2;
        score += scoreTextMatch(item.replayJobId, query) * 2;
        score += scoreTextMatch(item.service, query);
        score += scoreTextMatch(item.level, query);
    }

    score += item.level === 'error' ? 30 : item.level === 'warn' ? 20 : 10;

    return score;
}

function mapEventResult(event: {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    status: string;
    receivedAt: Date;
    processedAt: Date | null;
    replayCount: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    requestIp: string | null;
    tenant: { name: string };
    endpoint: { name: string };
    attempts: unknown[];
    signatureVerifiedAt: Date | null;
    queuedAt: Date | null;
    processingFinishedAt: Date | null;
    nextRetryAt: Date | null;
    dlqMovedAt: Date | null;
}): SearchEventItem {
    return {
        id: event.id,
        tenantId: event.tenantId,
        tenantName: event.tenant?.name ?? 'Unknown tenant',
        endpointId: event.endpointId,
        endpointName: event.endpoint?.name ?? 'Unknown endpoint',
        providerSlug: event.providerSlug,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        status: event.status,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        lastUpdatedAt: getEventLastUpdatedAt(event),
        replayCount: event.replayCount,
        attemptCount: Array.isArray(event.attempts) ? event.attempts.length : 0,
        lastFailureReason: event.lastFailureReason,
        lastFailureCategory: event.lastFailureCategory,
        dedupeKey: event.dedupeKey,
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        requestIp: event.requestIp,
    };
}

function mapPayloadResult(event: {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    status: string;
    receivedAt: Date;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    tenant: { name: string };
    endpoint: { name: string };
}): SearchPayloadItem {
    const previewParts = [
        event.eventType,
        event.externalEventId,
        event.dedupeKey,
        event.lastFailureReason,
        event.lastFailureCategory,
    ].filter(Boolean);

    return {
        id: event.id,
        eventId: event.id,
        tenantId: event.tenantId,
        tenantName: event.tenant?.name ?? 'Unknown tenant',
        endpointId: event.endpointId,
        endpointName: event.endpoint?.name ?? 'Unknown endpoint',
        providerSlug: event.providerSlug,
        eventType: event.eventType,
        externalEventId: event.externalEventId,
        status: event.status,
        receivedAt: event.receivedAt,
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        dedupeKey: event.dedupeKey,
        payloadPreview: previewParts.join(' • '),
        lastFailureReason: event.lastFailureReason,
        lastFailureCategory: event.lastFailureCategory,
    };
}

function mapAttemptResult(attempt: {
    id: string;
    eventId: string;
    attemptNumber: number;
    status: string;
    failureCategory: string | null;
    responseCode: number | null;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    nextRetryAt: Date | null;
    workerName: string | null;
    createdAt: Date;
    event: {
        tenantId: string;
        endpointId: string;
        providerSlug: string;
        eventType: string;
        externalEventId: string | null;
        tenant: { name: string };
        endpoint: { name: string };
    };
}): SearchAttemptItem {
    return {
        id: attempt.id,
        eventId: attempt.eventId,
        tenantId: attempt.event.tenantId,
        tenantName: attempt.event.tenant?.name ?? 'Unknown tenant',
        endpointId: attempt.event.endpointId,
        endpointName: attempt.event.endpoint?.name ?? 'Unknown endpoint',
        providerSlug: attempt.event.providerSlug,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        failureCategory: attempt.failureCategory,
        responseCode: attempt.responseCode,
        errorMessage: attempt.errorMessage,
        durationMs: attempt.durationMs,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        nextRetryAt: attempt.nextRetryAt,
        workerName: attempt.workerName,
        createdAt: attempt.createdAt,
        eventType: attempt.event.eventType,
        externalEventId: attempt.event.externalEventId,
    };
}

function mapReplayResult(replay: {
    id: string;
    eventId: string | null;
    tenantId: string;
    requestedBy: string | null;
    replayStatus: string;
    createdAt: Date;
    finishedAt: Date | null;
    tenant: { name: string };
    event: {
        tenantId: string;
        endpointId: string;
        providerSlug: string;
        eventType: string;
        tenant: { name: string };
        endpoint: { name: string };
    } | null;
}): SearchReplayItem {
    return {
        id: replay.id,
        eventId: replay.eventId,
        tenantId: replay.tenantId,
        tenantName: replay.tenant?.name ?? 'Unknown tenant',
        endpointId: replay.event?.endpointId ?? null,
        endpointName: replay.event?.endpoint?.name ?? null,
        providerSlug: replay.event?.providerSlug ?? null,
        eventType: replay.event?.eventType ?? null,
        requestedBy: replay.requestedBy,
        replayStatus: replay.replayStatus,
        createdAt: replay.createdAt,
        finishedAt: replay.finishedAt,
    };
}

function mapEventLog(event: {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    eventType: string;
    status: string;
    receivedAt: Date;
    processedAt: Date | null;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    tenant: { name: string };
    endpoint: { name: string };
}): SearchLogItem {
    const isError =
        event.status.includes('failed') ||
        event.status === 'moved_to_dlq' ||
        event.status === 'replay_failed';

    const service: SearchLogItem['service'] = 'api';
    const level: SearchLogItem['level'] = isError ? 'error' : 'info';

    return {
        id: `event-${event.id}-${event.status}-${event.receivedAt.toISOString()}`,
        timestamp: (event.processedAt ?? event.receivedAt).toISOString(),
        service,
        level,
        message: `Event ${event.eventType} moved to ${event.status}`,
        eventId: event.id,
        tenantId: event.tenantId,
        tenantName: event.tenant?.name ?? 'Unknown tenant',
        endpointId: event.endpointId,
        endpointName: event.endpoint?.name ?? 'Unknown endpoint',
        providerSlug: event.providerSlug,
        attemptNumber: null,
        replayJobId: null,
        errorMessage: event.lastFailureReason ?? event.lastFailureCategory ?? null,
    };
}

function mapAttemptLog(attempt: {
    id: string;
    eventId: string;
    attemptNumber: number;
    status: string;
    failureCategory: string | null;
    errorMessage: string | null;
    workerName: string | null;
    createdAt: Date;
    startedAt: Date | null;
    event: {
        tenantId: string;
        endpointId: string;
        providerSlug: string;
        eventType: string;
        tenant: { name: string };
        endpoint: { name: string };
    };
}): SearchLogItem {
    const isError = attempt.status !== 'succeeded';

    const service: SearchLogItem['service'] = 'worker';
    const level: SearchLogItem['level'] = isError ? 'error' : 'info';

    return {
        id: `attempt-${attempt.id}`,
        timestamp: (attempt.startedAt ?? attempt.createdAt).toISOString(),
        service,
        level,
        message: `Attempt #${attempt.attemptNumber} for ${attempt.event.eventType} ended as ${attempt.status}`,
        eventId: attempt.eventId,
        tenantId: attempt.event.tenantId,
        tenantName: attempt.event.tenant?.name ?? 'Unknown tenant',
        endpointId: attempt.event.endpointId,
        endpointName: attempt.event.endpoint?.name ?? 'Unknown endpoint',
        providerSlug: attempt.event.providerSlug,
        attemptNumber: attempt.attemptNumber,
        replayJobId: null,
        errorMessage: attempt.errorMessage ?? attempt.failureCategory ?? null,
    };
}

function mapReplayLog(replay: {
    id: string;
    eventId: string | null;
    tenantId: string;
    requestedBy: string | null;
    replayStatus: string;
    createdAt: Date;
    finishedAt: Date | null;
    tenant: { name: string };
    event: {
        tenantId: string;
        endpointId: string;
        providerSlug: string;
        eventType: string;
        tenant: { name: string };
        endpoint: { name: string };
    } | null;
}): SearchLogItem {
    const isError = replay.replayStatus === 'failed';

    const service: SearchLogItem['service'] = 'dashboard';
    const level: SearchLogItem['level'] = isError ? 'error' : 'info';

    return {
        id: `replay-${replay.id}`,
        timestamp: (replay.finishedAt ?? replay.createdAt).toISOString(),
        service,
        level,
        message: `Replay ${replay.replayStatus} for ${replay.event?.eventType ?? replay.eventId ?? 'event'}`,
        eventId: replay.eventId,
        tenantId: replay.tenantId,
        tenantName: replay.tenant?.name ?? 'Unknown tenant',
        endpointId: replay.event?.endpointId ?? null,
        endpointName: replay.event?.endpoint?.name ?? null,
        providerSlug: replay.event?.providerSlug ?? null,
        attemptNumber: null,
        replayJobId: replay.id,
        errorMessage: replay.replayStatus === 'failed' ? 'Replay failed' : null,
    };
}

function dedupeStrings(values: string[]): string[] {
    return Array.from(
        new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
    );
}

export const searchRouter = Router();

searchRouter.get('/events', async (req, res) => {
    try {
        const actor = requireActor(req);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const limit = parseLimit(query.limit);
        const offset = parseOffset(query.offset);
        const q = firstText(query.q);
        const sort = normalizeSort(query.sort);

        const where = buildEventWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const items = await db.webhookEvent.findMany({
            where: where,
            orderBy: { receivedAt: sort === 'oldest' ? 'asc' : 'desc' },
            take: Math.max(offset + limit, 50),
            include: {
                tenant: true,
                endpoint: true,
                attempts: { select: { id: true } },
            },
        });

        const mapped = items.map((event) => mapEventResult(event));
        const ranked = rankItems(mapped, {
            query: q,
            sort,
            score: (item) => scoreEventResult(item, q),
            time: (item) => item.receivedAt,
            id: (item) => item.id,
        });

        res.json({
            items: ranked.slice(offset, offset + limit),
            page: {
                limit,
                offset,
                total: ranked.length,
            },
        } satisfies SearchPage<SearchEventItem>);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search events',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.get('/payloads', async (req, res) => {
    try {
        const actor = requireActor(req);
        assertSensitiveSearchAccess(actor);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const limit = parseLimit(query.limit);
        const offset = parseOffset(query.offset);
        const q = firstText(query.q);
        const sort = normalizeSort(query.sort);

        const where = buildEventWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const items = await db.webhookEvent.findMany({
            where: where,
            orderBy: { receivedAt: sort === 'oldest' ? 'asc' : 'desc' },
            take: Math.max(offset + limit, 50),
            include: {
                tenant: true,
                endpoint: true,
            },
        });

        const mapped = items.map((event) => mapPayloadResult(event));
        const ranked = rankItems(mapped, {
            query: q,
            sort,
            score: (item) => scorePayloadResult(item, q),
            time: (item) => item.receivedAt,
            id: (item) => item.id,
        });

        res.json({
            items: ranked.slice(offset, offset + limit),
            page: {
                limit,
                offset,
                total: ranked.length,
            },
        } satisfies SearchPage<SearchPayloadItem>);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search payloads',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.get('/attempts', async (req, res) => {
    try {
        const actor = requireActor(req);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const limit = parseLimit(query.limit);
        const offset = parseOffset(query.offset);
        const q = firstText(query.q);
        const sort = normalizeSort(query.sort);

        const where = buildAttemptWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const items = await db.deliveryAttempt.findMany({
            where: where,
            orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
            take: Math.max(offset + limit, 50),
            include: {
                event: {
                    include: {
                        tenant: true,
                        endpoint: true,
                    },
                },
            },
        });

        const mapped = items.map((attempt) => mapAttemptResult(attempt));
        const ranked = rankItems(mapped, {
            query: q,
            sort,
            score: (item) => scoreAttemptResult(item, q),
            time: (item) => item.createdAt,
            id: (item) => item.id,
        });

        res.json({
            items: ranked.slice(offset, offset + limit),
            page: {
                limit,
                offset,
                total: ranked.length,
            },
        } satisfies SearchPage<SearchAttemptItem>);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search attempts',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.get('/replays', async (req, res) => {
    try {
        const actor = requireActor(req);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const limit = parseLimit(query.limit);
        const offset = parseOffset(query.offset);
        const q = firstText(query.q);
        const sort = normalizeSort(query.sort);

        const where = buildReplayWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const items = await db.replayJob.findMany({
            where: where,
            orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
            take: Math.max(offset + limit, 50),
            include: {
                tenant: true,
                event: {
                    include: {
                        tenant: true,
                        endpoint: true,
                    },
                },
            },
        });

        const mapped = items.map((replay) => mapReplayResult(replay));
        const ranked = rankItems(mapped, {
            query: q,
            sort,
            score: (item) => scoreReplayResult(item, q),
            time: (item) => item.createdAt,
            id: (item) => item.id,
        });

        res.json({
            items: ranked.slice(offset, offset + limit),
            page: {
                limit,
                offset,
                total: ranked.length,
            },
        } satisfies SearchPage<SearchReplayItem>);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search replays',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.get('/logs', async (req, res) => {
    try {
        const actor = requireActor(req);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const limit = parseLimit(query.limit);
        const offset = parseOffset(query.offset);
        const q = firstText(query.q);
        const sort = normalizeSort(query.sort);

        const eventWhere = buildEventWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const attemptWhere = buildAttemptWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const replayWhere = buildReplayWhere({
            q,
            tenantId: scopedTenantId,
            endpointId: firstText(query.endpointId),
            providerSlug: firstText(query.providerSlug),
            status: firstText(query.status),
            range: (firstText(query.range) as TimeRangePreset | undefined) ?? undefined,
            from: firstText(query.from),
            to: firstText(query.to),
            limit,
            offset,
            sort,
        });

        const take = Math.max(offset + limit, 50);

        const [events, attempts, replays] = await Promise.all([
            db.webhookEvent.findMany({
                where: eventWhere,
                orderBy: { receivedAt: sort === 'oldest' ? 'asc' : 'desc' },
                take,
                include: {
                    tenant: true,
                    endpoint: true,
                },
            }),
            db.deliveryAttempt.findMany({
                where: attemptWhere,
                orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
                take,
                include: {
                    event: {
                        include: {
                            tenant: true,
                            endpoint: true,
                        },
                    },
                },
            }),
            db.replayJob.findMany({
                where: replayWhere,
                orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
                take,
                include: {
                    tenant: true,
                    event: {
                        include: {
                            tenant: true,
                            endpoint: true,
                        },
                    },
                },
            }),
        ]);

        const combined = [
            ...events.map((event) => mapEventLog(event)),
            ...attempts.map((attempt) => mapAttemptLog(attempt)),
            ...replays.map((replay) => mapReplayLog(replay)),
        ];

        const ranked = rankItems(combined, {
            query: q,
            sort,
            score: (item) => scoreLogResult(item, q),
            time: (item) => new Date(item.timestamp),
            id: (item) => item.id,
        });

        res.json({
            items: ranked.slice(offset, offset + limit),
            page: {
                limit,
                offset,
                total: ranked.length,
            },
        } satisfies SearchPage<SearchLogItem>);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search logs',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.get('/suggestions', async (req, res) => {
    try {
        const actor = requireActor(req);
        const query = req.query as Record<string, unknown>;
        const tenantScope = resolveSearchTenantScope(actor, firstText(query.tenantId));
        const scopedTenantId = tenantScope ?? firstText(query.tenantId);
        const q = firstText(query.q)?.toLowerCase();
        const endpointId = firstText(query.endpointId);
        const providerSlug = firstText(query.providerSlug);

        const [events, endpoints, attempts, replays] = await Promise.all([
            db.webhookEvent.findMany({
                where: {
                    ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
                    ...(endpointId ? { endpointId } : {}),
                    ...(providerSlug ? { providerSlug } : {}),
                },
                take: 50,
                orderBy: { receivedAt: 'desc' },
                select: {
                    eventType: true,
                    providerSlug: true,
                    lastFailureReason: true,
                    lastFailureCategory: true,
                },
            }),
            db.endpoint.findMany({
                where: {
                    ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
                },
                take: 25,
                orderBy: { updatedAt: 'desc' },
                select: {
                    name: true,
                    providerSlug: true,
                },
            }),
            db.deliveryAttempt.findMany({
                where: {
                    ...(scopedTenantId || endpointId || providerSlug
                        ? {
                            event: {
                                ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
                                ...(endpointId ? { endpointId } : {}),
                                ...(providerSlug ? { providerSlug } : {}),
                            },
                        }
                        : {}),
                },
                take: 25,
                orderBy: { createdAt: 'desc' },
                select: {
                    failureCategory: true,
                    errorMessage: true,
                },
            }),
            db.replayJob.findMany({
                where: {
                    ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
                },
                take: 25,
                orderBy: { createdAt: 'desc' },
                select: {
                    replayStatus: true,
                    requestedBy: true,
                },
            }),
        ]);

        const values = dedupeStrings([
            ...events.flatMap((event) => [
                event.eventType,
                event.providerSlug,
                event.lastFailureReason ?? '',
                event.lastFailureCategory ?? '',
            ]),
            ...endpoints.flatMap((endpoint) => [endpoint.name, endpoint.providerSlug]),
            ...attempts.flatMap((attempt) => [
                attempt.failureCategory ?? '',
                attempt.errorMessage ?? '',
            ]),
            ...replays.flatMap((replay) => [replay.replayStatus, replay.requestedBy ?? '']),
        ]);

        const filtered = q
            ? values.filter((value) => value.toLowerCase().includes(q))
            : values;

        res.json({
            items: filtered.slice(0, 20),
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to load search suggestions',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.post('/index/:eventId', async (req, res) => {
    const actor = requireActor(req);
    assertSensitiveSearchAccess(actor);
    const { eventId } = req.params;

    try {
        const result = await indexEventForSearch({
            eventId,
            requestId:
                typeof req.body?.requestId === 'string' ? req.body.requestId : null,
        });

        return res.status(200).json({
            status: 'ok',
            result,
        });
    } catch (error) {
        recordSearchIndexOutcome({
            operation: 'index',
            outcome: 'failed',
            durationMs: 0,
            eventId,
            errorCategory:
                error instanceof Error ? error.message : 'search_index_failed',
        });

        return res.status(500).json({
            status: 'error',
            message: 'Search indexing failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

searchRouter.post('/backfill', async (req, res) => {
    try {
        const actor = requireActor(req);
        assertSensitiveSearchAccess(actor);
        const tenantId =
            typeof req.body?.tenantId === 'string' ? req.body.tenantId : null;

        const result = await backfillSearchIndex({
            tenantId,
            requestId:
                typeof req.body?.requestId === 'string' ? req.body.requestId : null,
            batchSize:
                typeof req.body?.batchSize === 'number' ? req.body.batchSize : undefined,
        });

        return res.status(200).json({
            status: 'ok',
            result,
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Search backfill failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});