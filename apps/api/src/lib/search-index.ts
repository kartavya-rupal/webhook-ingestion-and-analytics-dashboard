import { Client } from '@opensearch-project/opensearch';
import { performance } from 'node:perf_hooks';
import { db } from './clients';
import { env } from '../config/env';
import {
    observeSearchIndexing,
    recordSearchIndexOutcome,
    logWithContext,
} from './telemetry';
import { redactSensitiveHeaders } from './redaction';

type SearchEventDocument = {
    eventId: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    status: string;
    receivedAt: string;
    processedAt: string | null;
    lastUpdatedAt: string;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    rawPayloadSize: number | null;
    replayCount: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    queueMessageId: string | null;
    requestId: string | null;
    requestHeaders: Record<string, unknown> | null;
};

function getSearchClient(): Client | null {
    const node = env.OPENSEARCH_URL?.trim();

    if (!node) {
        return null;
    }

    return new Client({
        node,
        auth:
            env.OPENSEARCH_USERNAME?.trim()
                ? {
                    username: env.OPENSEARCH_USERNAME,
                    password: env.OPENSEARCH_PASSWORD ?? '',
                }
                : undefined,
    });
}

function getIndexName(): string {
    return (
        process.env.OPENSEARCH_INDEX_EVENTS?.trim() ||
        'finrelay-webhook-events'
    );
}

function toSearchDocument(event: {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    status: string;
    receivedAt: Date;
    processedAt: Date | null;
    lastUpdatedAt?: Date | null;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    rawPayloadSize: number | null;
    replayCount: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    queueMessageId: string | null;
    requestHeaders: Record<string, unknown> | null;
    requestId?: string | null;
}): SearchEventDocument {
    const lastUpdatedAt =
        event.lastUpdatedAt ??
        event.processedAt ??
        event.receivedAt;

    return {
        eventId: event.id,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        status: event.status,
        receivedAt: event.receivedAt.toISOString(),
        processedAt: event.processedAt ? event.processedAt.toISOString() : null,
        lastUpdatedAt: lastUpdatedAt.toISOString(),
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        dedupeKey: event.dedupeKey,
        rawPayloadSize: event.rawPayloadSize,
        replayCount: event.replayCount,
        lastFailureReason: event.lastFailureReason,
        lastFailureCategory: event.lastFailureCategory,
        queueMessageId: event.queueMessageId,
        requestId: event.requestId ?? null,
        requestHeaders: redactSensitiveHeaders(event.requestHeaders),
    };
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
    retryAttempts: number,
    retryBackoffMs: number,
    fn: () => Promise<T>,
): Promise<{ result: T; retries: number }> {
    let lastError: unknown;
    let retries = 0;

    for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
        try {
            const result = await fn();
            return { result, retries };
        } catch (error) {
            lastError = error;
            retries += 1;

            if (attempt < retryAttempts - 1) {
                const delayMs = retryBackoffMs * (attempt + 1);
                await sleep(delayMs);
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Search indexing failed');
}

export async function indexEventForSearch(input: {
    eventId: string;
    requestId?: string | null;
}): Promise<{
    indexed: boolean;
    skipped: boolean;
    retries: number;
}> {
    const startedAt = performance.now();
    const client = getSearchClient();
    const indexName = getIndexName();

    const event = await db.webhookEvent.findUnique({
        where: { id: input.eventId },
    });

    if (!event) {
        recordSearchIndexOutcome({
            operation: 'index',
            outcome: 'failed',
            durationMs: performance.now() - startedAt,
            eventId: input.eventId,
            errorCategory: 'event_not_found',
        });

        throw new Error(`Event not found: ${input.eventId}`);
    }

    if (!client) {
        recordSearchIndexOutcome({
            operation: 'index',
            outcome: 'skipped',
            durationMs: performance.now() - startedAt,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
            requestId: input.requestId ?? null,
            documentCount: 1,
            errorCategory: 'opensearch_not_configured',
        });

        logWithContext('warn', 'search indexing skipped because OpenSearch is not configured', {
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
        });

        return { indexed: false, skipped: true, retries: 0 };
    }

    const document = toSearchDocument({
        ...event,
        lastUpdatedAt:
            event.processingFinishedAt ??
            event.processedAt ??
            event.dlqMovedAt ??
            event.nextRetryAt ??
            event.queuedAt ??
            event.signatureVerifiedAt ??
            event.receivedAt,
        requestHeaders: (event.requestHeaders as Record<string, unknown> | null) ?? null,
        requestId: input.requestId ?? null,
    });

    const retryAttempts = Number(process.env.SEARCH_INDEX_RETRY_ATTEMPTS ?? '3');
    const retryBackoffMs = Number(process.env.SEARCH_INDEX_RETRY_BACKOFF_MS ?? '500');

    const { retries } = await observeSearchIndexing(
        {
            operation: 'index',
            indexName,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
            requestId: input.requestId ?? null,
        },
        async () => {
            const indexed = await withRetry(retryAttempts, retryBackoffMs, async () =>
                client.index({
                    index: indexName,
                    id: event.id,
                    body: document,
                    refresh: 'wait_for',
                }),
            );

            return indexed;
        },
    );

    recordSearchIndexOutcome({
        operation: 'index',
        outcome: 'success',
        durationMs: performance.now() - startedAt,
        documentCount: 1,
        retryCount: retries,
        eventId: event.id,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        requestId: input.requestId ?? null,
    });

    return {
        indexed: true,
        skipped: false,
        retries,
    };
}

export async function backfillSearchIndex(input: {
    tenantId?: string | null;
    batchSize?: number;
    requestId?: string | null;
}): Promise<{
    indexedCount: number;
    skipped: boolean;
}> {
    const startedAt = performance.now();
    const client = getSearchClient();
    const indexName = getIndexName();
    const batchSize = input.batchSize ?? Number(process.env.SEARCH_INDEX_BATCH_SIZE ?? '100');

    if (!client) {
        recordSearchIndexOutcome({
            operation: 'backfill',
            outcome: 'skipped',
            durationMs: performance.now() - startedAt,
            tenantId: input.tenantId ?? null,
            requestId: input.requestId ?? null,
            errorCategory: 'opensearch_not_configured',
        });

        return { indexedCount: 0, skipped: true };
    }

    let indexedCount = 0;
    let offset = 0;

    while (true) {
        const events = await db.webhookEvent.findMany({
            where: input.tenantId ? { tenantId: input.tenantId } : undefined,
            orderBy: { receivedAt: 'asc' },
            take: batchSize,
            skip: offset,
        });

        if (events.length === 0) {
            break;
        }

        const operations = events.flatMap((event) => {
            const lastUpdatedAt =
                event.processingFinishedAt ??
                event.processedAt ??
                event.dlqMovedAt ??
                event.nextRetryAt ??
                event.queuedAt ??
                event.signatureVerifiedAt ??
                event.receivedAt;

            return [
                { index: { _index: indexName, _id: event.id } },
                {
                    eventId: event.id,
                    tenantId: event.tenantId,
                    endpointId: event.endpointId,
                    providerSlug: event.providerSlug,
                    externalEventId: event.externalEventId,
                    eventType: event.eventType,
                    status: event.status,
                    receivedAt: event.receivedAt.toISOString(),
                    processedAt: event.processedAt ? event.processedAt.toISOString() : null,
                    lastUpdatedAt: lastUpdatedAt.toISOString(),
                    payloadPath: event.payloadPath,
                    payloadHash: event.payloadHash,
                    dedupeKey: event.dedupeKey,
                    rawPayloadSize: event.rawPayloadSize,
                    replayCount: event.replayCount,
                    lastFailureReason: event.lastFailureReason,
                    lastFailureCategory: event.lastFailureCategory,
                    queueMessageId: event.queueMessageId,
                    requestHeaders: redactSensitiveHeaders((event.requestHeaders as Record<string, unknown> | null) ?? null),
                    requestId: input.requestId ?? null,
                },
            ];
        });

        await observeSearchIndexing(
            {
                operation: 'backfill',
                indexName,
                tenantId: input.tenantId ?? null,
                requestId: input.requestId ?? null,
            },
            async () => {
                await client.bulk({
                    refresh: true,
                    body: operations,
                });
            },
        );

        indexedCount += events.length;
        offset += events.length;
    }

    recordSearchIndexOutcome({
        operation: 'backfill',
        outcome: 'success',
        durationMs: performance.now() - startedAt,
        documentCount: indexedCount,
        tenantId: input.tenantId ?? null,
        requestId: input.requestId ?? null,
    });

    return { indexedCount, skipped: false };
}