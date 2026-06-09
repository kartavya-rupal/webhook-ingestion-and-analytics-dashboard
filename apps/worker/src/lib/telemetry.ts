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

// type DbWriteOutcome = 'success' | 'error';

type WorkerClaimOutcome =
    | 'claimed'
    | 'already_processing'
    | 'missing'
    | 'terminal'
    | 'not_claimable';

type QueueAckOutcome =
    | 'deleted'
    | 'deleted_after_failure'
    | 'failed'
    | 'skipped'
    | 'handler_failure';

type WorkerProcessingOutcome =
    | 'success'
    | 'retryable_failure'
    | 'non_retryable_failure'
    | 'poison_failure'
    | 'handler_failure';

const serviceName = env.OTEL_SERVICE_NAME ?? 'finrelay-worker';

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

const queueConsumeTotal = new Counter({
    name: 'finrelay_queue_consume_total',
    help: 'Queue message consumption count',
    labelNames: ['queueName', 'providerSlug', 'redelivered'],
    registers: [registry],
});

const queueLagMs = new Histogram({
    name: 'finrelay_queue_lag_ms',
    help: 'Queue lag in milliseconds',
    labelNames: ['queueName'],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
    registers: [registry],
});

const queueAckTotal = new Counter({
    name: 'finrelay_queue_ack_total',
    help: 'Queue acknowledgement outcomes',
    labelNames: ['queueName', 'outcome'],
    registers: [registry],
});

const workerClaimTotal = new Counter({
    name: 'finrelay_worker_claim_total',
    help: 'Worker claim outcomes',
    labelNames: ['outcome'],
    registers: [registry],
});

const workerProcessingTotal = new Counter({
    name: 'finrelay_worker_processing_total',
    help: 'Worker processing outcomes',
    labelNames: ['outcome'],
    registers: [registry],
});

const workerProcessingDurationMs = new Histogram({
    name: 'finrelay_worker_processing_duration_ms',
    help: 'Worker processing duration in milliseconds',
    labelNames: ['outcome'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
});

const retryScheduledTotal = new Counter({
    name: 'finrelay_retry_scheduled_total',
    help: 'Retry schedules created by the worker',
    labelNames: ['providerSlug'],
    registers: [registry],
});

const retryExhaustedTotal = new Counter({
    name: 'finrelay_retry_exhausted_total',
    help: 'Retry exhaustion events in the worker',
    labelNames: ['providerSlug'],
    registers: [registry],
});

const retryDelayMs = new Histogram({
    name: 'finrelay_retry_delay_ms',
    help: 'Retry backoff delay in milliseconds',
    labelNames: ['providerSlug'],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000],
    registers: [registry],
});

function cleanAttributes(
    attributes: SpanAttrs,
): Record<string, string | number | boolean> {
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

async function observeSpan<T>(
    spanName: string,
    attributes: SpanAttrs,
    fn: () => Promise<T>,
): Promise<T> {
    const tracer = trace.getTracer('finrelay-worker');

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
                const durationMs = Number(
                    (process.hrtime.bigint() - startedAt) / 1_000_000n,
                );
                span.setAttribute('finrelay.duration_ms', durationMs);
                span.end();
            }
        },
    );
}

export function logWithContext(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields: Record<string, unknown> = {},
) {
    logger[level](
        {
            ...getTraceContext(),
            ...fields,
        },
        message,
    );
}

export async function observeWorkerStage<T>(
    stage: string,
    attributes: SpanAttrs,
    fn: () => Promise<T>,
): Promise<T> {
    return observeSpan(stage, attributes, fn);
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
    const startedAt = process.hrtime.bigint();

    try {
        return await observeSpan(
            `db.write.${input.entity}.${input.operation}`,
            {
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
            },
            async () => {
                const result = await fn();

                dbWriteTotal.inc({
                    entity: input.entity,
                    operation: input.operation,
                    outcome: 'success',
                });

                return result;
            },
        );
    } catch (error) {
        dbWriteTotal.inc({
            entity: input.entity,
            operation: input.operation,
            outcome: 'error',
        });
        throw error;
    } finally {
        const durationMs = Number(
            (process.hrtime.bigint() - startedAt) / 1_000_000n,
        );

        dbWriteDurationMs.observe(
            {
                entity: input.entity,
                operation: input.operation,
            },
            durationMs,
        );
    }
}

export function recordQueueConsume(input: {
    queueName: string;
    providerSlug: string;
    queueLagMs?: number | null;
    receiveCount?: number | null;
    eventId?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    requestId?: string | null;
}) {
    queueConsumeTotal.inc({
        queueName: input.queueName,
        providerSlug: input.providerSlug,
        redelivered: (input.receiveCount ?? 1) > 1 ? 'yes' : 'no',
    });

    if (typeof input.queueLagMs === 'number' && Number.isFinite(input.queueLagMs)) {
        queueLagMs.observe(
            {
                queueName: input.queueName,
            },
            input.queueLagMs,
        );
    }

    logWithContext('info', 'queue message consumed', {
        queueName: input.queueName,
        providerSlug: input.providerSlug,
        queueLagMs: input.queueLagMs ?? null,
        receiveCount: input.receiveCount ?? null,
        eventId: input.eventId ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        requestId: input.requestId ?? null,
    });
}

export function recordQueueAck(input: {
    queueName: string;
    outcome: QueueAckOutcome;
    eventId?: string | null;
    providerSlug?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    requestId?: string | null;
    receiveCount?: number | null;
}) {
    queueAckTotal.inc({
        queueName: input.queueName,
        outcome: input.outcome,
    });

    logWithContext('info', 'queue acknowledgement', {
        queueName: input.queueName,
        outcome: input.outcome,
        eventId: input.eventId ?? null,
        providerSlug: input.providerSlug ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        requestId: input.requestId ?? null,
        receiveCount: input.receiveCount ?? null,
    });
}

export function recordWorkerClaimOutcome(input: {
    outcome: WorkerClaimOutcome;
    eventId?: string | null;
    providerSlug?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    requestId?: string | null;
}) {
    workerClaimTotal.inc({
        outcome: input.outcome,
    });

    logWithContext('info', 'worker claim outcome', {
        outcome: input.outcome,
        eventId: input.eventId ?? null,
        providerSlug: input.providerSlug ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        requestId: input.requestId ?? null,
    });
}

export function recordWorkerProcessingOutcome(input: {
    outcome: WorkerProcessingOutcome;
    durationMs: number;
    eventId?: string | null;
    attemptNumber?: number | null;
    providerSlug?: string | null;
    tenantId?: string | null;
    endpointId?: string | null;
    requestId?: string | null;
    errorCategory?: string | null;
}) {
    workerProcessingTotal.inc({
        outcome: input.outcome,
    });

    workerProcessingDurationMs.observe(
        {
            outcome: input.outcome,
        },
        input.durationMs,
    );

    logWithContext('info', 'worker processing outcome', {
        outcome: input.outcome,
        durationMs: input.durationMs,
        eventId: input.eventId ?? null,
        attemptNumber: input.attemptNumber ?? null,
        providerSlug: input.providerSlug ?? null,
        tenantId: input.tenantId ?? null,
        endpointId: input.endpointId ?? null,
        requestId: input.requestId ?? null,
        errorCategory: input.errorCategory ?? null,
    });
}

export function getMetricsRegistry() {
    return registry;
}

export function recordRetryScheduled(input: {
    providerSlug: string;
    eventId: string;
    attemptNumber: number;
    delayMs: number;
    nextRetryAt: Date;
}) {
    retryScheduledTotal.inc({ providerSlug: input.providerSlug });
    retryDelayMs.observe({ providerSlug: input.providerSlug }, input.delayMs);

    logWithContext('info', 'retry scheduled', {
        providerSlug: input.providerSlug,
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
        delayMs: input.delayMs,
        nextRetryAt: input.nextRetryAt.toISOString(),
    });
}

export function recordRetryExhausted(input: {
    providerSlug: string;
    eventId: string;
    attemptNumber: number;
    reason: string;
}) {
    retryExhaustedTotal.inc({ providerSlug: input.providerSlug });

    logWithContext('warn', 'retry exhausted', {
        providerSlug: input.providerSlug,
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
        reason: input.reason,
    });
}