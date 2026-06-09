export type ActorRole = 'viewer' | 'operator' | 'admin';

export type ActorContext = {
    userId: string;
    email: string;
    role: ActorRole;
    tenantId: string | null;
    service: 'api' | 'dashboard';
};

export class ForbiddenActionError extends Error {
    statusCode = 403;

    constructor(message = 'Action not allowed') {
        super(message);
        this.name = 'ForbiddenActionError';
    }
}

export class ForbiddenTenantError extends Error {
    statusCode = 403;

    constructor(message = 'Tenant access denied') {
        super(message);
        this.name = 'ForbiddenTenantError';
    }
}

export function canReplay(role: ActorRole): boolean {
    return role === 'operator' || role === 'admin';
}

export function canManageSensitiveRoutes(role: ActorRole): boolean {
    return role === 'admin' || role === 'operator';
}

export function canViewAllTenants(role: ActorRole): boolean {
    return role === 'admin';
}

export function assertTenantAccess(
    actor: ActorContext,
    tenantId: string,
): void {
    if (actor.role === 'admin') {
        return;
    }

    if (!actor.tenantId || actor.tenantId !== tenantId) {
        throw new ForbiddenTenantError();
    }
}

export function tenantScopedWhere<T extends Record<string, unknown>>(
    actor: ActorContext,
    where: T = {} as T,
): T & Record<string, unknown> {
    if (actor.role === 'admin') {
        return where;
    }

    if (!actor.tenantId) {
        throw new ForbiddenTenantError();
    }

    return {
        ...where,
        tenantId: actor.tenantId,
    } as T & Record<string, unknown>;
}

export function canInspectSensitiveData(role: ActorRole): boolean {
    return role === 'operator' || role === 'admin';
}