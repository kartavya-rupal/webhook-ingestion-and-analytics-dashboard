import {
    ForbiddenActionError,
    type ActorContext,
} from '@finrelay/shared';

export function resolveAnalyticsTenantScope(
    actor: ActorContext,
    requestedTenantId?: string | null,
): string | null {
    if (actor.role === 'admin') {
        return requestedTenantId ?? null;
    }

    if (!actor.tenantId) {
        throw new ForbiddenActionError('Tenant scope required');
    }

    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
        throw new ForbiddenActionError('Tenant access denied');
    }

    return actor.tenantId;
}

export function assertGlobalAnalyticsAccess(actor: ActorContext): void {
    if (actor.role !== 'admin') {
        throw new ForbiddenActionError('Admin access required');
    }
}