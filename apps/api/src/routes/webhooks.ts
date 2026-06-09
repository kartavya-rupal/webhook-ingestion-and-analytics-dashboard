import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
    WEBHOOK_ID_HEADER,
    WEBHOOK_SIGNATURE_HEADER,
    WEBHOOK_TIMESTAMP_HEADER,
    type WebhookEnvelope,
} from '@finrelay/shared';
import { db, redis, s3, sqs } from '../lib/clients';
import { env } from '../config/env';
import {
    mapWebhookSignatureFailureToStatusCode,
    verifyWebhookSignature,
} from '../lib/webhook-signature';
import {
    archiveWebhookPayload,
    hashWebhookPayload,
} from '../lib/webhook-storage';
import {
    releaseWebhookDedupeKey,
    reserveWebhookDedupeKey,
} from '../lib/webhook-dedupe';
import { enqueueWebhookEvent } from '../lib/webhook-queue';
import {
    observeDbWrite,
    observeWebhookRequest,
    observeWebhookStage,
    recordWebhookOutcome,
    logWithContext,
} from '../lib/telemetry';
import { resolveWebhookSigningSecret } from '../lib/webhook-secret';
import { reserveWebhookReplaySignature } from '../lib/webhook-replay';
import { assertApiRateLimit } from '../lib/rate-limit';

type RawWebhookBody = Buffer;
type HeaderValue = string | string[] | null | undefined;

function normalizeHeader(value: HeaderValue): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

function getRequestHeaderSnapshot(req: express.Request) {
    return {
        contentType: normalizeHeader(req.header('content-type')),
        userAgent: normalizeHeader(req.header('user-agent')),
        signature: normalizeHeader(req.header(WEBHOOK_SIGNATURE_HEADER)),
        timestamp: normalizeHeader(req.header(WEBHOOK_TIMESTAMP_HEADER)),
        webhookId: normalizeHeader(req.header(WEBHOOK_ID_HEADER)),
    };
}

function normalizeProviderSlug(provider: string | undefined): string {
    return (provider ?? '').trim().toLowerCase();
}

function isBufferBody(body: unknown): body is RawWebhookBody {
    return Buffer.isBuffer(body);
}

export function createWebhooksRouter() {
    const router = Router();

    router.post(
        '/:provider',
        express.raw({ type: 'application/json', limit: '1mb' }),
        async (req, res) => {
            const providerSlug = normalizeProviderSlug(req.params.provider);
            const requestId =
                normalizeHeader(req.header('x-request-id')) ?? randomUUID();
            const requestStartedAt = performance.now();

            return observeWebhookRequest(
                {
                    providerSlug: providerSlug || 'unknown',
                    requestId,
                    route: 'webhook.ingress',
                },
                async () => {
                    if (!providerSlug) {
                        recordWebhookOutcome({
                            providerSlug: 'unknown',
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'missing_provider',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Missing provider slug',
                        });
                    }

                    const rateLimit = await assertApiRateLimit({
                        key: `webhook:${providerSlug}:${req.ip ?? 'unknown'}`,
                        limit: 120,
                        windowSeconds: 60,
                    });

                    if (!rateLimit.allowed) {
                        res.setHeader('Retry-After', String(rateLimit.resetInSeconds));
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 429,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'rate_limited',
                        });

                        return res.status(429).json({
                            status: 'error',
                            message: 'Webhook rate limit exceeded',
                        });
                    }

                    if (!req.is('application/json')) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 415,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'unsupported_content_type',
                        });

                        return res.status(415).json({
                            status: 'error',
                            message: 'Only application/json payloads are supported',
                        });
                    }

                    if (!isBufferBody(req.body)) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'invalid_body',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Webhook body must be sent as raw JSON bytes',
                        });
                    }

                    const rawBody = req.body;
                    if (rawBody.length === 0) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'empty_body',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Empty webhook body',
                        });
                    }

                    const endpoint = await db.endpoint.findUnique({
                        where: { providerSlug },
                        select: {
                            id: true,
                            tenantId: true,
                            providerSlug: true,
                            status: true,
                            signingSecretReference: true,
                        },
                    });

                    if (!endpoint || endpoint.status !== 'active') {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 404,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            errorCategory: 'inactive_provider',
                        });

                        return res.status(404).json({
                            status: 'error',
                            message: 'Unknown or inactive provider',
                        });
                    }

                    let signingSecret: string;
                    try {
                        signingSecret = await resolveWebhookSigningSecret({
                            signingSecretReference:
                                endpoint.signingSecretReference ?? null,
                            providerSlug,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                        });
                    } catch (error) {
                        const reason =
                            error instanceof Error
                                ? error.message
                                : 'Missing signing secret';

                        logWithContext('error', 'Webhook signing secret unavailable', {
                            providerSlug,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'missing_signing_secret',
                            reason,
                        });

                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 503,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'missing_signing_secret',
                        });

                        return res.status(503).json({
                            status: 'error',
                            message: 'Webhook signing secret unavailable',
                        });
                    }

                    const signatureHeader = normalizeHeader(
                        req.header(WEBHOOK_SIGNATURE_HEADER),
                    );
                    const timestampHeader = normalizeHeader(
                        req.header(WEBHOOK_TIMESTAMP_HEADER),
                    );
                    const webhookIdHeader = normalizeHeader(
                        req.header(WEBHOOK_ID_HEADER),
                    );

                    const verification = await observeWebhookStage(
                        'webhook.signature_verify',
                        {
                            providerSlug,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                        },
                        async () =>
                            verifyWebhookSignature({
                                signingSecret,
                                timestampHeader,
                                signatureHeader,
                                rawBody,
                            }),
                    );

                    if (!verification.ok) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode:
                                mapWebhookSignatureFailureToStatusCode(
                                    verification.reason,
                                ),
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: `signature_${verification.reason}`,
                        });

                        return res
                            .status(
                                mapWebhookSignatureFailureToStatusCode(
                                    verification.reason,
                                ),
                            )
                            .json({
                                status: 'error',
                                message: 'Webhook signature verification failed',
                                reason: verification.reason,
                            });
                    }

                    const replayReserved = await reserveWebhookReplaySignature({
                        redis,
                        providerSlug,
                        timestampSeconds: verification.timestampSeconds,
                        signatureHeader: signatureHeader ?? '',
                        ttlSeconds: 360,
                    });

                    if (!replayReserved) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 409,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'replay_detected',
                        });

                        return res.status(409).json({
                            status: 'error',
                            message: 'Webhook replay detected',
                        });
                    }

                    console.log('RAW BODY UTF8');
                    console.log(rawBody.toString('utf8'));

                    console.log('RAW BODY HEX');
                    console.log(rawBody.toString('hex'));
                    
                    let payload: WebhookEnvelope;
                    try {
                        payload = JSON.parse(
                            rawBody.toString('utf8'),
                        ) as WebhookEnvelope;
                    } catch {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'invalid_json',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Webhook payload is not valid JSON',
                        });
                    }

                    const externalEventId = (webhookIdHeader ?? payload.id ?? '').trim();
                    if (!externalEventId) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'missing_event_id',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Missing webhook id',
                        });
                    }

                    const eventType = (payload.type ?? '').trim();
                    if (!eventType) {
                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 400,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'missing_event_type',
                        });

                        return res.status(400).json({
                            status: 'error',
                            message: 'Missing event type',
                        });
                    }

                    const payloadHash = hashWebhookPayload(rawBody);
                    const dedupeKey = `${endpoint.tenantId}:${providerSlug}:${externalEventId}`;

                    const dedupeReserved = await observeWebhookStage(
                        'webhook.dedupe',
                        {
                            providerSlug,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            eventId: externalEventId,
                        },
                        async () =>
                            reserveWebhookDedupeKey({
                                redis,
                                dedupeKey,
                                value: externalEventId,
                                ttlSeconds: env.DEDUP_TTL_SECONDS,
                            }),
                    );

                    if (!dedupeReserved) {
                        const existingEvent = await db.webhookEvent.findUnique({
                            where: {
                                tenantId_dedupeKey: {
                                    tenantId: endpoint.tenantId,
                                    dedupeKey,
                                },
                            },
                        });

                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'duplicate',
                            statusCode: 200,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            eventId: existingEvent?.id ?? null,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                        });

                        return res.status(200).json({
                            status: 'duplicate',
                            duplicate: true,
                            eventId: existingEvent?.id ?? null,
                            provider: providerSlug,
                            message: 'Event already ingested or in progress',
                        });
                    }

                    const requestHeaders = getRequestHeaderSnapshot(req);
                    const receivedAt = new Date();

                    let createdEventId: string | null = null;

                    try {
                        const createdEvent = await observeDbWrite(
                            {
                                entity: 'webhook_event',
                                operation: 'create',
                                providerSlug,
                                requestId,
                                tenantId: endpoint.tenantId,
                                endpointId: endpoint.id,
                            },
                            async () =>
                                db.webhookEvent.create({
                                    data: {
                                        tenantId: endpoint.tenantId,
                                        endpointId: endpoint.id,
                                        providerSlug,
                                        externalEventId,
                                        eventType,
                                        payloadPath: 'pending',
                                        payloadHash,
                                        rawPayloadSize: rawBody.length,
                                        requestHeaders,
                                        requestIp: req.ip ?? null,
                                        dedupeKey,
                                        signatureVerifiedAt: receivedAt,
                                        status: 'verified',
                                    },
                                }),
                        );

                        createdEventId = createdEvent.id;

                        const archived = await observeWebhookStage(
                            'webhook.s3_write',
                            {
                                providerSlug,
                                requestId,
                                tenantId: endpoint.tenantId,
                                endpointId: endpoint.id,
                                eventId: createdEvent.id,
                            },
                            async () =>
                                archiveWebhookPayload({
                                    s3,
                                    bucketName: env.S3_BUCKET_NAME,
                                    tenantId: endpoint.tenantId,
                                    providerSlug,
                                    eventId: createdEvent.id,
                                    rawBody,
                                }),
                        );

                        await observeDbWrite(
                            {
                                entity: 'webhook_event',
                                operation: 'update',
                                providerSlug,
                                requestId,
                                tenantId: endpoint.tenantId,
                                endpointId: endpoint.id,
                                eventId: createdEvent.id,
                            },
                            async () =>
                                db.webhookEvent.update({
                                    where: { id: createdEvent.id },
                                    data: {
                                        payloadPath: archived.payloadPath,
                                        payloadHash,
                                        rawPayloadSize: rawBody.length,
                                        status: 'persisted',
                                    },
                                }),
                        );

                        const queueMessageId = await observeWebhookStage(
                            'queue.publish',
                            {
                                providerSlug,
                                requestId,
                                tenantId: endpoint.tenantId,
                                endpointId: endpoint.id,
                                eventId: createdEvent.id,
                            },
                            async () =>
                                enqueueWebhookEvent({
                                    sqs,
                                    queueUrl: env.SQS_MAIN_QUEUE_URL,
                                    message: {
                                        eventId: createdEvent.id,
                                        tenantId: endpoint.tenantId,
                                        endpointId: endpoint.id,
                                        providerSlug,
                                        externalEventId,
                                        eventType,
                                        payloadPath: archived.payloadPath,
                                        payloadHash,
                                    },
                                }),
                        );

                        await observeDbWrite(
                            {
                                entity: 'webhook_event',
                                operation: 'update',
                                providerSlug,
                                requestId,
                                tenantId: endpoint.tenantId,
                                endpointId: endpoint.id,
                                eventId: createdEvent.id,
                            },
                            async () =>
                                db.webhookEvent.update({
                                    where: { id: createdEvent.id },
                                    data: {
                                        status: 'queued',
                                        queuedAt: new Date(),
                                        queueMessageId: queueMessageId ?? undefined,
                                    },
                                }),
                        );

                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'accepted',
                            statusCode: 202,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            eventId: createdEvent.id,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                        });

                        return res.status(202).json({
                            status: 'accepted',
                            duplicate: false,
                            eventId: createdEvent.id,
                            provider: providerSlug,
                            queued: true,
                        });
                    } catch (error) {
                        const reason =
                            error instanceof Error
                                ? error.message
                                : 'Unknown ingestion failure';

                        if (createdEventId) {
                            const eventId = createdEventId;

                            await observeDbWrite(
                                {
                                    entity: 'webhook_event',
                                    operation: 'update',
                                    providerSlug,
                                    requestId,
                                    tenantId: endpoint.tenantId,
                                    endpointId: endpoint.id,
                                    eventId,
                                },
                                async () =>
                                    db.webhookEvent.update({
                                        where: { id: eventId },
                                        data: {
                                            ingestionError: reason,
                                        },
                                    }),
                            ).catch(() => undefined);
                        }

                        await releaseWebhookDedupeKey({
                            redis,
                            dedupeKey,
                        }).catch(() => undefined);

                        logWithContext('error', 'Webhook ingestion failed', {
                            providerSlug,
                            requestId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            eventId: createdEventId,
                            errorCategory: 'ingestion_failure',
                            reason,
                        });

                        recordWebhookOutcome({
                            providerSlug,
                            outcome: 'error',
                            statusCode: 503,
                            durationMs: performance.now() - requestStartedAt,
                            requestId,
                            eventId: createdEventId,
                            tenantId: endpoint.tenantId,
                            endpointId: endpoint.id,
                            errorCategory: 'ingestion_failure',
                        });

                        return res.status(503).json({
                            status: 'error',
                            message: 'Webhook ingestion failed',
                            reason,
                        });
                    }
                },
            );
        },
    );

    return router;
}