import { Router, type Response } from 'express';
import { performance } from 'node:perf_hooks';
import { db } from '@finrelay/db';
import { canInspectSensitiveData, ForbiddenActionError, type ActorContext } from '@finrelay/shared';
import { readArchivedPayloadText } from '../lib/s3';
import { assertApiRateLimit } from '../lib/rate-limit';
import { redactSensitiveText } from '../lib/redaction';
import {
    logWithContext,
    observeDbWrite,
    observeReplayStage,
    recordReplayOutcome,
} from '../lib/telemetry';
import {
    requireActor,
} from '../lib/authz';
import { recordAuditEvent } from '../lib/audit';
import { canReplay } from '@finrelay/shared';

function handleRouteError(
    res: Response,
    error: unknown,
    fallbackMessage: string,
) {
    if (error instanceof ForbiddenActionError) {
        return res.status(error.statusCode).json({
            status: 'error',
            message: error.message,
            reason: error.message,
        });
    }

    return res.status(500).json({
        status: 'error',
        message: fallbackMessage,
        reason: error instanceof Error ? error.message : 'Unknown error',
    });
}

function resolveTenantScope(
    actor: ActorContext,
    requestedTenantId?: string | null,
): string | null {
    if (actor.role === 'admin') {
        const explicitTenantId = requestedTenantId?.trim();
        if (explicitTenantId) {
            return explicitTenantId;
        }

        const selectedTenantId = actor.tenantId?.trim();
        return selectedTenantId || null;
    }

    if (!actor.tenantId) {
        throw new ForbiddenActionError('Tenant scope required');
    }

    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
        throw new ForbiddenActionError('Tenant access denied');
    }

    return actor.tenantId;
}

function buildScopedWhere(
    actor: ActorContext,
    where: Record<string, unknown> = {},
    requestedTenantId?: string | null,
): Record<string, unknown> {
    const tenantScope = resolveTenantScope(actor, requestedTenantId);

    if (!tenantScope) {
        return where;
    }

    return {
        ...where,
        tenantId: tenantScope,
    };
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

function redactRequestHeaders(headers: unknown): unknown {
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
        return null;
    }

    const source = headers as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
        const normalized = key.toLowerCase();

        if (
            normalized.includes('authorization') ||
            normalized.includes('cookie') ||
            normalized.includes('set-cookie') ||
            normalized.includes('token') ||
            normalized.includes('secret') ||
            normalized.includes('signature') ||
            normalized.includes('apikey') ||
            normalized.includes('api_key') ||
            normalized.includes('privatekey') ||
            normalized.includes('private_key')
        ) {
            redacted[key] = '[REDACTED]';
            continue;
        }

        redacted[key] = value;
    }

    return redacted;
}

function serializeDlqListItem(event: {
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
    dlqMovedAt: Date | null;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    replayCount: number;
    tenant: { id: string; name: string } | null;
    endpoint: { id: string; name: string; providerSlug: string } | null;
    signatureVerifiedAt: Date | null;
    queuedAt: Date | null;
    processingFinishedAt: Date | null;
    nextRetryAt: Date | null;
    requestHeaders: unknown;
    requestIp: string | null;
    rawPayloadSize: number | null;
    queueMessageId: string | null;
    processingStartedAt: Date | null;
    lastAttemptNumber: number;
    _count: {
        attempts: number;
    };
}) {
    return {
        id: event.id,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        dedupeKey: event.dedupeKey,
        status: event.status,
        receivedAt: event.receivedAt,
        lastUpdatedAt: getEventLastUpdatedAt(event),
        processedAt: event.processedAt,
        attemptCount: event._count.attempts,
        replayCount: event.replayCount,
        dlqMovedAt: event.dlqMovedAt,
        lastFailureReason: event.lastFailureReason,
        lastFailureCategory: event.lastFailureCategory,
        tenant: event.tenant
            ? {
                id: event.tenant.id,
                name: event.tenant.name,
            }
            : null,
        endpoint: event.endpoint
            ? {
                id: event.endpoint.id,
                name: event.endpoint.name,
                providerSlug: event.endpoint.providerSlug,
            }
            : null,
    };
}

function serializeAttempt(attempt: {
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
}) {
    return {
        id: attempt.id,
        eventId: attempt.eventId,
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
    };
}

function serializeEventDetail(event: {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    payloadPath: string;
    payloadHash: string;
    rawPayloadSize: number | null;
    requestHeaders: unknown;
    requestIp: string | null;
    dedupeKey: string;
    signatureVerifiedAt: Date | null;
    queuedAt: Date | null;
    queueMessageId: string | null;
    processingStartedAt: Date | null;
    processingFinishedAt: Date | null;
    lastAttemptNumber: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    nextRetryAt: Date | null;
    dlqMovedAt: Date | null;
    status: string;
    receivedAt: Date;
    processedAt: Date | null;
    replayCount: number;
    tenant: { id: string; name: string; status: string } | null;
    endpoint: { id: string; name: string; providerSlug: string } | null;
    attempts: Array<{
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
    }>;
    _count: {
        attempts: number;
    };
}) {
    return {
        id: event.id,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        rawPayloadSize: event.rawPayloadSize,
        requestHeaders: redactRequestHeaders(event.requestHeaders),
        requestIp: event.requestIp,
        dedupeKey: event.dedupeKey,
        signatureVerifiedAt: event.signatureVerifiedAt,
        queuedAt: event.queuedAt,
        queueMessageId: event.queueMessageId,
        processingStartedAt: event.processingStartedAt,
        processingFinishedAt: event.processingFinishedAt,
        lastAttemptNumber: event.lastAttemptNumber,
        lastFailureReason: event.lastFailureReason,
        lastFailureCategory: event.lastFailureCategory,
        nextRetryAt: event.nextRetryAt,
        dlqMovedAt: event.dlqMovedAt,
        status: event.status,
        receivedAt: event.receivedAt,
        lastUpdatedAt: getEventLastUpdatedAt(event),
        processedAt: event.processedAt,
        replayCount: event.replayCount,
        attemptCount: event._count.attempts,
        tenant: event.tenant
            ? {
                id: event.tenant.id,
                name: event.tenant.name,
                status: event.tenant.status,
            }
            : null,
        endpoint: event.endpoint
            ? {
                id: event.endpoint.id,
                name: event.endpoint.name,
                providerSlug: event.endpoint.providerSlug,
            }
            : null,
        attempts: event.attempts.map(serializeAttempt),
    };
}

function parseLimit(value: unknown, fallback = 25, max = 100): number {
    const raw = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.min(raw, max);
}

function parseOffset(value: unknown): number {
    const raw = typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return raw;
}

async function enforceRouteRateLimit(
    res: Response,
    input: {
        key: string;
        limit: number;
        windowSeconds: number;
        message: string;
    },
): Promise<boolean> {
    const result = await assertApiRateLimit({
        key: input.key,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
    });

    if (result.allowed) {
        return true;
    }

    res.setHeader('Retry-After', String(result.resetInSeconds));
    res.status(429).json({
        status: 'error',
        message: input.message,
    });

    return false;
}

export const readModelRouter = Router();

readModelRouter.get('/tenants', async (req, res) => {
    try {
        const actor = requireActor(req);

        const tenantScope = actor.role === 'admin' ? null : actor.tenantId;

        const tenants = await db.tenant.findMany({
            where: tenantScope ? { id: tenantScope } : undefined,
            orderBy: { createdAt: 'desc' },
        });

        const items = await Promise.all(
            tenants.map(async (tenant) => {
                const [endpointCount, eventCount, latestEvent] = await Promise.all([
                    db.endpoint.count({ where: { tenantId: tenant.id } }),
                    db.webhookEvent.count({ where: { tenantId: tenant.id } }),
                    db.webhookEvent.findFirst({
                        where: { tenantId: tenant.id },
                        orderBy: { receivedAt: 'desc' },
                        select: { receivedAt: true, status: true, eventType: true },
                    }),
                ]);

                return {
                    id: tenant.id,
                    name: tenant.name,
                    status: tenant.status,
                    createdAt: tenant.createdAt,
                    updatedAt: tenant.updatedAt,
                    endpointCount,
                    eventCount,
                    latestEvent: latestEvent ?? null,
                };
            }),
        );

        res.json({ items });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load tenants');
    }
});

readModelRouter.get('/tenants/:tenantId', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { tenantId } = req.params;

        resolveTenantScope(actor, tenantId);

        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            include: {
                endpoints: {
                    select: {
                        id: true,
                        tenantId: true,
                        providerSlug: true,
                        name: true,
                        url: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!tenant) {
            return res.status(404).json({
                status: 'error',
                message: 'Tenant not found',
            });
        }

        res.json({ tenant });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load tenant');
    }
});

readModelRouter.get('/tenants/:tenantId/summary', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { tenantId } = req.params;

        resolveTenantScope(actor, tenantId);

        const [tenant, endpointCount, totalEvents, succeededEvents, retryableFailures, dlqEvents, latestEvent] =
            await Promise.all([
                db.tenant.findUnique({ where: { id: tenantId } }),
                db.endpoint.count({ where: { tenantId } }),
                db.webhookEvent.count({ where: { tenantId } }),
                db.webhookEvent.count({
                    where: { tenantId, status: 'succeeded' },
                }),
                db.webhookEvent.count({
                    where: { tenantId, status: 'failed_retryable' },
                }),
                db.webhookEvent.count({
                    where: { tenantId, status: 'moved_to_dlq' },
                }),
                db.webhookEvent.findFirst({
                    where: { tenantId },
                    orderBy: { receivedAt: 'desc' },
                    select: { receivedAt: true, status: true, eventType: true },
                }),
            ]);

        if (!tenant) {
            return res.status(404).json({
                status: 'error',
                message: 'Tenant not found',
            });
        }

        res.json({
            tenantId,
            endpointCount,
            totalEvents,
            succeededEvents,
            retryableFailures,
            dlqEvents,
            latestEvent: latestEvent ?? null,
        });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load tenant summary');
    }
});

readModelRouter.get('/endpoints', async (req, res) => {
    console.log('endpoint request', {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        actor: req.actor,
    });
    try {
        const actor = requireActor(req);
        const tenantScope = resolveTenantScope(actor);

        console.log("actor at endpoints is", actor, "tenantScope is", tenantScope);

        const endpoints = await db.endpoint.findMany({
            where: tenantScope ? { tenantId: tenantScope } : undefined,
            orderBy: { createdAt: 'desc' },
        });

        console.log(endpoints);

        const items = await Promise.all(
            endpoints.map(async (endpoint) => {
                const [eventCount, failureCount, latestEvent] = await Promise.all([
                    db.webhookEvent.count({ where: { endpointId: endpoint.id } }),
                    db.webhookEvent.count({
                        where: {
                            endpointId: endpoint.id,
                            status: {
                                in: ['failed_retryable', 'failed_non_retryable', 'moved_to_dlq'],
                            },
                        },
                    }),
                    db.webhookEvent.findFirst({
                        where: { endpointId: endpoint.id },
                        orderBy: { receivedAt: 'desc' },
                        select: { receivedAt: true, status: true, eventType: true },
                    }),
                ]);

                return {
                    id: endpoint.id,
                    tenantId: endpoint.tenantId,
                    providerSlug: endpoint.providerSlug,
                    name: endpoint.name,
                    url: endpoint.url,
                    status: endpoint.status,
                    retryPolicy: endpoint.retryPolicy ?? null,
                    createdAt: endpoint.createdAt,
                    updatedAt: endpoint.updatedAt,
                    eventCount,
                    failureCount,
                    latestEvent: latestEvent ?? null,
                };
            }),
        );

        res.json({ items });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load endpoints');
    }
});

readModelRouter.get('/endpoints/:endpointId', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { endpointId } = req.params;
        const tenantScope = resolveTenantScope(actor);

        const endpoint = await db.endpoint.findFirst({
            where: tenantScope
                ? { id: endpointId, tenantId: tenantScope }
                : { id: endpointId },
            select: {
                id: true,
                tenantId: true,
                providerSlug: true,
                name: true,
                url: true,
                status: true,
                eventFilters: true,
                retryPolicy: true,
                createdAt: true,
                updatedAt: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });

        if (!endpoint) {
            return res.status(404).json({
                status: 'error',
                message: 'Endpoint not found',
            });
        }

        res.json({ endpoint });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load endpoint');
    }
});

readModelRouter.get('/events', async (req, res) => {
    try {
        const actor = requireActor(req);

        if (
            !(await enforceRouteRateLimit(res, {
                key: `read-model:events:${actor.role}:${actor.tenantId ?? 'global'}:${req.ip ?? 'unknown'}`,
                limit: 120,
                windowSeconds: 60,
                message: 'Event listing rate limit exceeded',
            }))
        ) {
            return;
        }

        const limit = parseLimit(req.query.limit, 20, 100);
        const offset = parseOffset(req.query.offset);
        const requestedTenantId =
            typeof req.query.tenantId === 'string'
                ? req.query.tenantId
                : undefined;
        const endpointId =
            typeof req.query.endpointId === 'string' ? req.query.endpointId : undefined;
        const providerSlug =
            typeof req.query.providerSlug === 'string'
                ? req.query.providerSlug
                : undefined;
        const status =
            typeof req.query.status === 'string' ? req.query.status : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const from =
            typeof req.query.from === 'string' && req.query.from.trim()
                ? new Date(req.query.from)
                : null;
        const to =
            typeof req.query.to === 'string' && req.query.to.trim()
                ? new Date(req.query.to)
                : null;

        const where: Record<string, unknown> = buildScopedWhere(
            actor,
            {},
            requestedTenantId,
        );

        if (endpointId) {
            where.endpointId = endpointId;
        }

        if (providerSlug) {
            where.providerSlug = providerSlug;
        }

        if (status) {
            where.status = status;
        }

        if (from || to) {
            where.receivedAt = {};
            if (from && !Number.isNaN(from.getTime())) {
                (where.receivedAt as Record<string, unknown>).gte = from;
            }
            if (to && !Number.isNaN(to.getTime())) {
                (where.receivedAt as Record<string, unknown>).lte = to;
            }
        }

        if (q.length > 0) {
            where.OR = [
                { id: { contains: q, mode: 'insensitive' } },
                { externalEventId: { contains: q, mode: 'insensitive' } },
                { eventType: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            db.webhookEvent.findMany({
                where,
                orderBy: { receivedAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    tenant: true,
                    endpoint: true,
                    _count: {
                        select: {
                            attempts: true,
                        },
                    },
                },
            }),
            db.webhookEvent.count({ where }),
        ]);

        const serialized = items.map((event) => ({
            id: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
            externalEventId: event.externalEventId,
            eventType: event.eventType,
            payloadPath: event.payloadPath,
            payloadHash: event.payloadHash,
            status: event.status,
            receivedAt: event.receivedAt,
            lastUpdatedAt: getEventLastUpdatedAt(event),
            attemptCount: event._count.attempts,
            processedAt: event.processedAt,
            replayCount: event.replayCount,
            tenant: event.tenant
                ? {
                    id: event.tenant.id,
                    name: event.tenant.name,
                }
                : undefined,
            endpoint: event.endpoint
                ? {
                    id: event.endpoint.id,
                    name: event.endpoint.name,
                    providerSlug: event.endpoint.providerSlug,
                }
                : undefined,
        }));

        res.json({
            items: serialized,
            page: {
                limit,
                offset,
                total,
            },
        });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load events');
    }
});

readModelRouter.get('/events/:eventId', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { eventId } = req.params;
        const tenantScope = resolveTenantScope(actor);

        if (
            !(await enforceRouteRateLimit(res, {
                key: `read-model:event-detail:${actor.role}:${actor.tenantId ?? 'global'}:${req.ip ?? 'unknown'}`,
                limit: 120,
                windowSeconds: 60,
                message: 'Event detail rate limit exceeded',
            }))
        ) {
            return;
        }

        const event = await db.webhookEvent.findFirst({
            where: tenantScope
                ? { id: eventId, tenantId: tenantScope }
                : { id: eventId },
            include: {
                tenant: true,
                endpoint: true,
                attempts: {
                    orderBy: { attemptNumber: 'asc' },
                },
                _count: {
                    select: {
                        attempts: true,
                    },
                },
            },
        });

        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'Event not found',
            });
        }

        res.json({ event: serializeEventDetail(event) });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load event');
    }
});

readModelRouter.get('/events/:eventId/payload', async (req, res) => {
    try {
        const actor = requireActor(req);

        if (!canInspectSensitiveData(actor.role)) {
            await recordAuditEvent({
                tenantId: actor.tenantId ?? 'unknown',
                actorType: 'user',
                actorId: actor.email,
                actionType: 'payload.view.denied',
                entityType: 'webhook_event',
                entityId: req.params.eventId,
                metadata: {
                    reason: 'insufficient_permissions',
                },
            }).catch(() => undefined);

            return res.status(403).json({
                status: 'error',
                message: 'Payload inspection requires operator access',
            });
        }

        const { eventId } = req.params;
        const tenantScope = resolveTenantScope(actor);

        const event = await db.webhookEvent.findFirst({
            where: tenantScope
                ? { id: eventId, tenantId: tenantScope }
                : { id: eventId },
            select: {
                id: true,
                payloadPath: true,
                eventType: true,
                externalEventId: true,
            },
        });

        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'Event not found',
            });
        }

        if (!event.payloadPath) {
            return res.status(404).json({
                status: 'error',
                message: 'Payload not found',
            });
        }

        const { text } = await readArchivedPayloadText(event.payloadPath);

        if (!text) {
            return res.status(404).json({
                status: 'error',
                message: 'Payload is empty',
            });
        }

        await recordAuditEvent({
            tenantId: actor.tenantId ?? eventId,
            actorType: 'user',
            actorId: actor.email,
            actionType: 'payload.viewed',
            entityType: 'webhook_event',
            entityId: event.id,
            metadata: {
                eventType: event.eventType,
                externalEventId: event.externalEventId,
            },
        }).catch(() => undefined);

        const redactedText = redactSensitiveText(text);

        try {
            const parsed = JSON.parse(redactedText);

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${event.id}.json"`,
            );

            return res.send(JSON.stringify(parsed, null, 2));
        } catch {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${event.id}.txt"`,
            );

            return res.send(redactedText);
        }
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load archived payload');
    }
});

readModelRouter.get('/events/:eventId/attempts', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { eventId } = req.params;
        const tenantScope = resolveTenantScope(actor);

        if (
            !(await enforceRouteRateLimit(res, {
                key: `read-model:event-attempts:${actor.role}:${actor.tenantId ?? 'global'}:${req.ip ?? 'unknown'}`,
                limit: 90,
                windowSeconds: 60,
                message: 'Event attempts rate limit exceeded',
            }))
        ) {
            return;
        }

        const event = await db.webhookEvent.findFirst({
            where: tenantScope
                ? { id: eventId, tenantId: tenantScope }
                : { id: eventId },
            select: {
                id: true,
            },
        });

        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'Event not found',
            });
        }

        const attempts = await db.deliveryAttempt.findMany({
            where: { eventId },
            orderBy: { attemptNumber: 'asc' },
        });

        res.json({ items: attempts });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load event attempts');
    }
});

readModelRouter.get('/dlq', async (req, res) => {
    try {
        const actor = requireActor(req);

        if (
            !(await enforceRouteRateLimit(res, {
                key: `read-model:dlq:${actor.role}:${actor.tenantId ?? 'global'}:${req.ip ?? 'unknown'}`,
                limit: 120,
                windowSeconds: 60,
                message: 'DLQ listing rate limit exceeded',
            }))
        ) {
            return;
        }

        const limit = parseLimit(req.query.limit, 25, 100);
        const offset = parseOffset(req.query.offset);
        const requestedTenantId =
            typeof req.query.tenantId === 'string'
                ? req.query.tenantId
                : undefined;
        const providerSlug =
            typeof req.query.providerSlug === 'string'
                ? req.query.providerSlug
                : undefined;
        const status =
            typeof req.query.status === 'string' ? req.query.status : undefined;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

        const where: Record<string, unknown> = buildScopedWhere(
            actor,
            {
                status: {
                    in: ['moved_to_dlq', 'failed_non_retryable'],
                },
            },
            requestedTenantId,
        );

        if (providerSlug) {
            where.providerSlug = providerSlug;
        }

        if (status) {
            where.status = status;
        }

        if (q.length > 0) {
            where.OR = [
                { id: { contains: q, mode: 'insensitive' } },
                { externalEventId: { contains: q, mode: 'insensitive' } },
                { eventType: { contains: q, mode: 'insensitive' } },
                { lastFailureReason: { contains: q, mode: 'insensitive' } },
                { providerSlug: { contains: q, mode: 'insensitive' } },
                { dedupeKey: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            db.webhookEvent.findMany({
                where,
                orderBy: { dlqMovedAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    tenant: true,
                    endpoint: true,
                    _count: {
                        select: {
                            attempts: true,
                        },
                    },
                },
            }),
            db.webhookEvent.count({ where }),
        ]);

        res.json({
            items: items.map(serializeDlqListItem),
            page: {
                limit,
                offset,
                total,
            },
        });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load DLQ events');
    }
});

readModelRouter.get('/dlq/:eventId', async (req, res) => {
    try {
        const actor = requireActor(req);
        const { eventId } = req.params;
        const tenantScope = resolveTenantScope(actor);

        const event = await db.webhookEvent.findFirst({
            where: tenantScope
                ? {
                    id: eventId,
                    tenantId: tenantScope,
                    status: {
                        in: ['moved_to_dlq', 'failed_non_retryable'],
                    },
                }
                : {
                    id: eventId,
                    status: {
                        in: ['moved_to_dlq', 'failed_non_retryable'],
                    },
                },
            include: {
                tenant: true,
                endpoint: true,
                attempts: {
                    orderBy: { attemptNumber: 'asc' },
                },
                _count: {
                    select: {
                        attempts: true,
                    },
                },
            },
        });

        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'DLQ event not found',
            });
        }

        res.json({ event: serializeEventDetail(event) });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load DLQ event');
    }
});

readModelRouter.post('/events/:eventId/replay', async (req, res) => {
    const actor = requireActor(req);
    const startedAt = performance.now();
    const { eventId } = req.params;
    const requestedBy =
        typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : actor.email;
    const tenantScope = resolveTenantScope(actor);

    if (!canReplay(actor.role)) {
        await recordAuditEvent({
            tenantId: actor.tenantId ?? 'unknown',
            actorType: 'user',
            actorId: actor.email,
            actionType: 'replay.denied',
            entityType: 'webhook_event',
            entityId: eventId,
            metadata: {
                reason: 'insufficient_permissions',
                requestedBy,
            },
        }).catch(() => undefined);

        return res.status(403).json({
            status: 'error',
            message: 'Replay permission required',
        });
    }

    try {
        const event = await db.webhookEvent.findFirst({
            where: tenantScope
                ? { id: eventId, tenantId: tenantScope }
                : { id: eventId },
        });

        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'Event not found',
            });
        }

        const replayJob = await observeReplayStage(
            'replay.request',
            {
                eventId,
                tenantId: event.tenantId,
                endpointId: event.endpointId,
                providerSlug: event.providerSlug,
            },
            async () =>
                observeDbWrite(
                    {
                        entity: 'replay_job',
                        operation: 'create',
                        eventId,
                        tenantId: event.tenantId,
                        endpointId: event.endpointId,
                        providerSlug: event.providerSlug,
                    },
                    async () =>
                        db.$transaction(async (tx) => {
                            const job = await tx.replayJob.create({
                                data: {
                                    tenantId: event.tenantId,
                                    eventId: event.id,
                                    requestedBy,
                                    replayStatus: 'requested',
                                },
                            });

                            await tx.webhookEvent.update({
                                where: { id: event.id },
                                data: {
                                    status: 'replay_requested',
                                    replayCount: {
                                        increment: 1,
                                    },
                                },
                            });

                            return job;
                        }),
                ),
        );

        await recordAuditEvent({
            tenantId: event.tenantId,
            actorType: 'user',
            actorId: actor.email,
            actionType: 'replay.requested',
            entityType: 'replay_job',
            entityId: replayJob.id,
            metadata: {
                eventId: event.id,
                endpointId: event.endpointId,
                providerSlug: event.providerSlug,
                requestedBy,
                role: actor.role,
            },
        }).catch(() => undefined);

        recordReplayOutcome({
            outcome: 'accepted',
            eventId,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            requestedBy,
            replayJobId: replayJob.id,
            durationMs: performance.now() - startedAt,
        });

        logWithContext('info', 'replay requested', {
            eventId,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
            replayJobId: replayJob.id,
            requestedBy,
        });

        return res.status(202).json({
            status: 'accepted',
            replayJob,
        });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to create replay job');
    }
});

readModelRouter.get('/replay-jobs', async (req, res) => {
    try {
        const actor = requireActor(req);
        const requestedTenantId =
            typeof req.query.tenantId === 'string'
                ? req.query.tenantId
                : undefined;
        const tenantScope = resolveTenantScope(actor, requestedTenantId);

        if (
            !(await enforceRouteRateLimit(res, {
                key: `read-model:replay-jobs:${actor.role}:${actor.tenantId ?? 'global'}:${req.ip ?? 'unknown'}`,
                limit: 60,
                windowSeconds: 60,
                message: 'Replay jobs rate limit exceeded',
            }))
        ) {
            return;
        }

        const replayJobs = await db.replayJob.findMany({
            where: tenantScope ? { tenantId: tenantScope } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                event: {
                    select: {
                        id: true,
                        eventType: true,
                        status: true,
                        externalEventId: true,
                        tenantId: true,
                        endpointId: true,
                    },
                },
            },
        });

        res.json({ items: replayJobs });
    } catch (error) {
        return handleRouteError(res, error, 'Failed to load replay jobs');
    }
});