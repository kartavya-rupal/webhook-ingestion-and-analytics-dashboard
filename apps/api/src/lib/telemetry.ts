import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import {
    collectDefaultMetrics,
    Counter,
    Histogram,
    Registry,
} from 'prom-client';
import { env } from '../config/env';
import { createServiceLogger } from '@finrelay/shared';

type SpanAttrs = Record<string, string | number | boolean | null | undefined>;

type WebhookOutcome = 'accepted' | 'duplicate' | 'error';

// type DbWriteOutcome = 'success' | 'error';

const serviceName = env.OTEL_SERVICE_NAME ?? 'finrelay-api';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

registry.setDefaultLabels({
    serviceName,
    environment: env.NODE_ENV,
});

export const logger = createServiceLogger({
    serviceName,
    environment: env.NODE_ENV,
    level: env.LOG_LEVEL ?? 'info',
});

const webhookRequestTotal = new Counter({
    name: 'finrelay_requests_total',
    help: 'Webhook request outcomes',
    labelNames: ['providerSlug', 'outcome'],
    registers: [registry],
});

const webhookRequestDurationMs = new Histogram({
    name: 'finrelay_request_duration_ms',
    help: 'Webhook request duration in milliseconds',
    labelNames: ['providerSlug', 'outcome'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
});

const webhookStageDurationMs = new Histogram({
    name: 'finrelay_webhook_stage_duration_ms',
    help: 'Webhook stage duration in milliseconds',
    labelNames: ['stage'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
});

const dbWriteTotal = new Counter({
    name: 'finrelay_db_write_total',
    help: 'Database write outcomes',
    labelNames: ['entity', 'operation', 'outcome'],
    registers: [registry],
});

const dbWriteDurationMs = new Histogram({
    name: 'finrelay_db_write_duration_ms',
    help: 'Database write duration in milliseconds',
    labelNames: ['entity', 'operation'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
});

const replayRequestTotal = new Counter({
    name: 'finrelay_replay_request_total',
    help: 'Replay request outcomes',
    labelNames: ['outcome'],
    registers: [registry],
});

const replayDurationMs = new Histogram({
    name: 'finrelay_replay_duration_ms',
    help: 'Replay duration in milliseconds',
    labelNames: ['outcome'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
});

const analyticsJobTotal = new Counter({
    name: 'finrelay_analytics_job_total',
    help: 'Analytics job outcomes',
    labelNames: ['outcome'],
    registers: [registry],
});

const analyticsJobDurationMs = new Histogram({
    name: 'finrelay_analytics_job_duration_ms',
    help: 'Analytics job duration in milliseconds',
    labelNames: ['jobName', 'outcome'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
});

const searchIndexTotal = new Counter({
    name: 'finrelay_search_index_total',
    help: 'Search indexing outcomes',
    labelNames: ['operation', 'outcome'],
    registers: [registry],
});

const searchIndexDurationMs = new Histogram({
    name: 'finrelay_search_index_duration_ms',
    help: 'Search indexing duration in milliseconds',
    labelNames: ['operation', 'outcome'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
});

const searchIndexDocumentsTotal = new Counter({
    name: 'finrelay_search_index_documents_total',
    help: 'Number of indexed search documents',
    labelNames: ['operation'],
    registers: [registry],
});

const searchIndexRetryTotal = new Counter({
    name: 'finrelay_search_index_retry_total',
    help: 'Search indexing retry count',
    labelNames: ['operation'],
    registers: [registry],
});

const searchBackfillTotal = new Counter({
    name: 'finrelay_search_backfill_total',
    help: 'Search backfill outcomes',
    labelNames: ['outcome'],
    registers: [registry],
});

export async function observeReplayStage<T>(
    spanName: string,
    attributes: SpanAttrs,
    fn: () => Promise<T>,
): Promise<T> {
    return observeSpan(spanName, attributes, fn);
}

export function recordReplayOutcome(input: {
    outcome: 'accepted' | 'failed';
    eventId?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    requestedBy?: string | null;
    durationMs: number;
    replayJobId?: string | null;
    errorCategory?: string | null;
}) {
    replayRequestTotal.inc({
        outcome: input.outcome,
    });

    replayDurationMs.observe(
        {
            outcome: input.outcome,
        },
        input.durationMs,
    );

    logWithContext('info', 'replay outcome', {
        outcome: input.outcome,
        eventId: input.eventId ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        requestedBy: input.requestedBy ?? null,
        replayJobId: input.replayJobId ?? null,
        durationMs: input.durationMs,
        errorCategory: input.errorCategory ?? null,
    });
}

export async function observeAnalyticsJob<T>(
    input: {
        jobName: string;
        tenantId?: string | null;
        requestId?: string | null;
    },
    fn: () => Promise<T>,
): Promise<T> {
    const startedAt = process.hrtime.bigint();

    try {
        return await observeSpan(
            'analytics.job',
            {
                'service.name': serviceName,
                'finrelay.job_name': input.jobName,
                'finrelay.tenant_id': input.tenantId,
                'finrelay.request_id': input.requestId,
            },
            async () => {
                const result = await fn();

                analyticsJobTotal.inc({
                    outcome: 'success',
                });

                return result;
            },
        );
    } catch (error) {
        analyticsJobTotal.inc({
            outcome: 'error',
        });
        throw error;
    } finally {
        const durationMs = Number(
            (process.hrtime.bigint() - startedAt) / 1_000_000n,
        );

        analyticsJobDurationMs.observe(
            {
                jobName: input.jobName,
                outcome: 'completed',
            },
            durationMs,
        );
    }
}

export function recordAnalyticsJobOutcome(input: {
    jobName: string;
    outcome: 'success' | 'error';
    durationMs: number;
    tenantId?: string | null;
    requestId?: string | null;
    processedCount?: number | null;
    errorCategory?: string | null;
}) {
    analyticsJobTotal.inc({
        outcome: input.outcome,
    });

    analyticsJobDurationMs.observe(
        {
            jobName: input.jobName,
            outcome: input.outcome,
        },
        input.durationMs,
    );

    logWithContext('info', 'analytics job outcome', {
        jobName: input.jobName,
        outcome: input.outcome,
        durationMs: input.durationMs,
        tenantId: input.tenantId ?? null,
        requestId: input.requestId ?? null,
        processedCount: input.processedCount ?? null,
        errorCategory: input.errorCategory ?? null,
    });
}

function cleanAttributes(attributes: SpanAttrs): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === '') {
            continue;
        }

        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

function getTraceContext() {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();

    return {
        traceId: spanContext?.traceId ?? null,
        spanId: spanContext?.spanId ?? null,
    };
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'Unknown error';
}

export function logWithContext(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields: Record<string, unknown> = {},
) {
    logger[level]({
        ...getTraceContext(),
        ...fields,
    }, message);
}

async function observeSpan<T>(
    spanName: string,
    attributes: SpanAttrs,
    fn: () => Promise<T>,
): Promise<T> {
    const tracer = trace.getTracer('finrelay-api');

    return tracer.startActiveSpan(
        spanName,
        { attributes: cleanAttributes(attributes) },
        async (span) => {
            const startedAt = process.hrtime.bigint();

            try {
                const result = await fn();
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.recordException(error as Error);
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: errorMessage(error),
                });
                throw error;
            } finally {
                const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
                span.setAttribute('finrelay.duration_ms', durationMs);
                span.end();
            }
        },
    );
}

export async function observeWebhookRequest<T>(
    input: {
        providerSlug: string;
        requestId: string;
        route: string;
        tenantId?: string | null;
        endpointId?: string | null;
        eventId?: string | null;
    },
    fn: () => Promise<T>,
): Promise<T> {
    return observeSpan('webhook.ingress', {
        'service.name': serviceName,
        'finrelay.request_id': input.requestId,
        'finrelay.provider_slug': input.providerSlug,
        'finrelay.route': input.route,
        'finrelay.tenant_id': input.tenantId ?? undefined,
        'finrelay.endpoint_id': input.endpointId ?? undefined,
        'finrelay.event_id': input.eventId ?? undefined,
    }, fn);
}

export async function observeWebhookStage<T>(
    stage: string,
    input: {
        providerSlug?: string;
        requestId?: string;
        eventId?: string;
        tenantId?: string;
        endpointId?: string;
        queueMessageId?: string;
    },
    fn: () => Promise<T>,
): Promise<T> {
    return observeSpan(stage, {
        'service.name': serviceName,
        'finrelay.request_id': input.requestId,
        'finrelay.provider_slug': input.providerSlug,
        'finrelay.event_id': input.eventId,
        'finrelay.tenant_id': input.tenantId,
        'finrelay.endpoint_id': input.endpointId,
        'finrelay.queue_message_id': input.queueMessageId,
    }, async () => {
        const startedAt = process.hrtime.bigint();
        try {
            return await fn();
        } finally {
            const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
            webhookStageDurationMs.observe({ stage }, durationMs);
        }
    });
}

export async function observeDbWrite<T>(
    input: {
        entity: string;
        operation: string;
        providerSlug?: string;
        requestId?: string;
        eventId?: string;
        tenantId?: string;
        endpointId?: string;
        attemptNumber?: number;
        replayJobId?: string;
    },
    fn: () => Promise<T>,
): Promise<T> {
    const spanName = `db.write.${input.entity}.${input.operation}`;

    return observeSpan(spanName, {
        'service.name': serviceName,
        'db.system': 'postgresql',
        'finrelay.entity': input.entity,
        'finrelay.operation': input.operation,
        'finrelay.provider_slug': input.providerSlug,
        'finrelay.request_id': input.requestId,
        'finrelay.event_id': input.eventId,
        'finrelay.tenant_id': input.tenantId,
        'finrelay.endpoint_id': input.endpointId,
        'finrelay.attempt_number': input.attemptNumber,
        'finrelay.replay_job_id': input.replayJobId,
    }, async () => {
        const startedAt = process.hrtime.bigint();

        try {
            const result = await fn();

            dbWriteTotal.inc({
                entity: input.entity,
                operation: input.operation,
                outcome: 'success',
            });

            return result;
        } catch (error) {
            dbWriteTotal.inc({
                entity: input.entity,
                operation: input.operation,
                outcome: 'error',
            });

            throw error;
        } finally {
            const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
            dbWriteDurationMs.observe({
                entity: input.entity,
                operation: input.operation,
            }, durationMs);
        }
    });
}

export function recordWebhookOutcome(input: {
    providerSlug: string;
    outcome: WebhookOutcome;
    statusCode: number;
    durationMs: number;
    requestId?: string | null;
    eventId?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    errorCategory?: string | null;
}) {
    webhookRequestTotal.inc({
        providerSlug: input.providerSlug,
        outcome: input.outcome,
    });

    webhookRequestDurationMs.observe({
        providerSlug: input.providerSlug,
        outcome: input.outcome,
    }, input.durationMs);

    logger.info({
        ...getTraceContext(),
        ...input,
    }, 'webhook outcome');
}

export function getMetricsRegistry() {
    return registry;
}

export async function observeSearchIndexing<T>(
    input: {
        operation: 'index' | 'backfill';
        indexName: string;
        eventId?: string | null;
        tenantId?: string | null;
        endpointId?: string | null;
        providerSlug?: string | null;
        requestId?: string | null;
        retryCount?: number | null;
    },
    fn: () => Promise<T>,
): Promise<T> {
    return observeSpan(
        'search.index',
        {
            'service.name': serviceName,
            'finrelay.operation': input.operation,
            'finrelay.index_name': input.indexName,
            'finrelay.event_id': input.eventId,
            'finrelay.tenant_id': input.tenantId,
            'finrelay.endpoint_id': input.endpointId,
            'finrelay.provider_slug': input.providerSlug,
            'finrelay.request_id': input.requestId,
            'finrelay.retry_count': input.retryCount,
        },
        async () => {
            const startedAt = process.hrtime.bigint();

            try {
                return await fn();
            } finally {
                const durationMs = Number(
                    (process.hrtime.bigint() - startedAt) / 1_000_000n,
                );

                searchIndexDurationMs.observe(
                    {
                        operation: input.operation,
                        outcome: 'completed',
                    },
                    durationMs,
                );
            }
        },
    );
}

export function recordSearchIndexOutcome(input: {
    operation: 'index' | 'backfill';
    outcome: 'success' | 'failed' | 'skipped';
    durationMs: number;
    documentCount?: number | null;
    retryCount?: number | null;
    eventId?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    providerSlug?: string | null;
    requestId?: string | null;
    errorCategory?: string | null;
}) {
    searchIndexTotal.inc({
        operation: input.operation,
        outcome: input.outcome,
    });

    searchIndexDurationMs.observe(
        {
            operation: input.operation,
            outcome: input.outcome,
        },
        input.durationMs,
    );

    if (typeof input.documentCount === 'number') {
        searchIndexDocumentsTotal.inc(
            {
                operation: input.operation,
            },
            input.documentCount,
        );
    }

    if (typeof input.retryCount === 'number' && input.retryCount > 0) {
        searchIndexRetryTotal.inc(
            {
                operation: input.operation,
            },
            input.retryCount,
        );
    }

    if (input.operation === 'backfill') {
        searchBackfillTotal.inc({
            outcome: input.outcome,
        });
    }

    logWithContext('info', 'search index outcome', {
        operation: input.operation,
        outcome: input.outcome,
        durationMs: input.durationMs,
        documentCount: input.documentCount ?? null,
        retryCount: input.retryCount ?? null,
        eventId: input.eventId ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        providerSlug: input.providerSlug ?? null,
        requestId: input.requestId ?? null,
        errorCategory: input.errorCategory ?? null,
    });
}