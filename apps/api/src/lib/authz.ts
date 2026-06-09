/* eslint-disable @typescript-eslint/no-namespace */

import type { Request } from 'express';
import {
    ActorContext,
    canReplay,
    ForbiddenActionError,
    ForbiddenTenantError,
    tenantScopedWhere,
} from '@finrelay/shared';

declare global {
    namespace Express {            // <---- lint error
        interface Request {
            actor?: ActorContext;
        }
    }
}

export function requireActor(req: Request): ActorContext {
    if (!req.actor) {
        throw new ForbiddenActionError('Missing authenticated actor');
    }

    return req.actor;
}

export function requireReplayActor(req: Request): ActorContext {
    const actor = requireActor(req);

    if (!canReplay(actor.role)) {
        throw new ForbiddenActionError('Replay permission required');
    }

    return actor;
}

export function requireAdminOrOperator(req: Request): ActorContext {
    const actor = requireActor(req);

    if (actor.role !== 'admin' && actor.role !== 'operator') {
        throw new ForbiddenActionError('Operator access required');
    }

    return actor;
}

export function scopeTenantWhere<T extends Record<string, unknown>>(
    actor: ActorContext,
    where: T,
): T & Record<string, unknown> {
    return tenantScopedWhere(actor, where);
}

export function assertSameTenant(actor: ActorContext, tenantId: string): void {
    if (actor.role === 'admin') {
        return;
    }

    if (!actor.tenantId || actor.tenantId !== tenantId) {
        throw new ForbiddenTenantError();
    }
}