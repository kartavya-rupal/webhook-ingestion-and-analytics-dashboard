import { NextRequest, NextResponse } from 'next/server';
import {
    DASHBOARD_SESSION_COOKIE,
    verifyDashboardSessionToken,
    type DashboardSession,
} from '@/lib/session';
import {
    canChangeAuthSettings,
    canManageAlerts,
    canManageEndpoints,
    canReplay,
} from '@/lib/permissions';

export type DashboardMutationArea =
    | 'replay'
    | 'endpoint'
    | 'alert'
    | 'auth';

function getApiAreaPermission(
    area: DashboardMutationArea,
    role: DashboardSession['role'],
): boolean {
    switch (area) {
        case 'replay':
            return canReplay(role);
        case 'endpoint':
            return canManageEndpoints(role);
        case 'alert':
            return canManageAlerts(role);
        case 'auth':
            return canChangeAuthSettings(role);
        default:
            return false;
    }
}

function sanitizeNextPath(value: string | null, fallback: string): string {
    if (!value || !value.startsWith('/')) {
        return fallback;
    }

    if (value.startsWith('//')) {
        return fallback;
    }

    return value;
}

async function getDashboardSessionFromRequest(
    request: NextRequest,
): Promise<DashboardSession | null> {
    const token = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;

    if (!token) {
        return null;
    }

    return verifyDashboardSessionToken(token);
}

function redirectToLogin(request: NextRequest, nextPath: string): NextResponse {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', nextPath);
    return NextResponse.redirect(url);
}

export async function requireDashboardMutationAccess(
    request: NextRequest,
    area: DashboardMutationArea,
): Promise<
    | { ok: true; session: DashboardSession }
    | { ok: false; response: NextResponse }
> {
    const session = await getDashboardSessionFromRequest(request);

    const nextPath = sanitizeNextPath(
        new URL(request.url).pathname,
        '/',
    );

    if (!session) {
        return {
            ok: false,
            response: redirectToLogin(request, nextPath),
        };
    }

    if (!getApiAreaPermission(area, session.role)) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    status: 'error',
                    message: 'Forbidden',
                },
                { status: 403 },
            ),
        };
    }

    return {
        ok: true,
        session,
    };
}