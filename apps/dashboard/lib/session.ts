import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';

export const DASHBOARD_SESSION_COOKIE = 'finrelay_dashboard_session';
export const DASHBOARD_SELECTED_TENANT_COOKIE = 'finrelay_dashboard_selected_tenant';
export const DASHBOARD_SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type DashboardUserRole = 'admin' | 'operator' | 'viewer';

export type DashboardSession = {
    email: string;
    name: string;
    role: DashboardUserRole;
    tenantId: string | null;
};

function getSecretValue(): string {
    const secret =
        process.env.DASHBOARD_JWT_SECRET ?? process.env.JWT_SECRET ?? '';

    if (!secret.trim()) {
        throw new Error(
            'Missing DASHBOARD_JWT_SECRET or JWT_SECRET for dashboard auth',
        );
    }

    return secret;

}

function getSecretKey(): Uint8Array {
    return new TextEncoder().encode(getSecretValue());
}

export function getDashboardSessionCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: DASHBOARD_SESSION_DURATION_SECONDS,
    };
}

export function getDashboardSelectedTenantCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: DASHBOARD_SESSION_DURATION_SECONDS,
    };
}

export async function createDashboardSessionToken(
    session: DashboardSession,
): Promise<string> {
    return new SignJWT({
        email: session.email,
        name: session.name,
        role: session.role,
        tenantId: session.tenantId,
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(session.email)
        .setIssuedAt()
        .setExpirationTime(`${ DASHBOARD_SESSION_DURATION_SECONDS }s`)
        .sign(getSecretKey());
}

export async function verifyDashboardSessionToken(
    token: string,
): Promise<DashboardSession | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());

        const email = typeof payload.email === 'string' ? payload.email : '';
        const name = typeof payload.name === 'string' ? payload.name : 'Operator';
        const role =
            payload.role === 'admin' ||
                payload.role === 'operator' ||
                payload.role === 'viewer'
                ? payload.role
                : 'viewer';

        const tenantId =
            typeof payload.tenantId === 'string' && payload.tenantId.trim()
                ? payload.tenantId.trim()
                : null;

        if (!email) {
            return null;
        }

        return {
            email,
            name,
            role,
            tenantId,
        };
    } catch {
        return null;
    }

}

export async function getDashboardSession(): Promise<DashboardSession | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;

    if (!token) {
        return null;
    }

    return verifyDashboardSessionToken(token);

}

export async function getDashboardSessionFromRequest(
    request: Request | { cookies: { get(name: string): { value?: string } | undefined } },
): Promise<DashboardSession | null> {
    const token = 'cookies' in request ? request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value : undefined;

    if (!token) {
        return null;
    }

    return verifyDashboardSessionToken(token);

}

export async function getDashboardSelectedTenantId(): Promise<string | null> {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get(DASHBOARD_SELECTED_TENANT_COOKIE)?.value;

    return tenantId && tenantId.trim() ? tenantId.trim() : null;

}