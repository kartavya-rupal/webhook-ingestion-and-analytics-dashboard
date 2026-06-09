import type { NextFunction, Request, Response } from 'express';
import type { ActorContext } from '@finrelay/shared';

export function attachActor(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    const email = req.header('x-dashboard-user-email');
    const role = req.header('x-dashboard-user-role');
    const tenantId = req.header('x-dashboard-tenant-id');

    if (!email || !role) {
        return next();
    }

    req.actor = {
        userId: email,
        email,
        role:
            role === 'admin' ||
                role === 'operator' ||
                role === 'viewer'
                ? role
                : 'viewer',
        tenantId: tenantId && tenantId.trim().length > 0 ? tenantId.trim() : null,
        service: 'dashboard',
    } satisfies ActorContext;

    next();

}