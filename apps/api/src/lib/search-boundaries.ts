import {
    canInspectSensitiveData,
    ForbiddenActionError,
    type ActorContext,
} from '@finrelay/shared';

export function resolveSearchTenantScope(
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

export function assertSensitiveSearchAccess(actor: ActorContext): void {
    if (!canInspectSensitiveData(actor.role)) {
        throw new ForbiddenActionError('Search inspection requires operator access');
    }
}