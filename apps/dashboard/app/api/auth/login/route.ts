import { NextRequest, NextResponse } from 'next/server';
import {
    authenticateDashboardLogin,
} from '@/lib/login';
import {
    DASHBOARD_SELECTED_TENANT_COOKIE,
    DASHBOARD_SESSION_COOKIE,
    createDashboardSessionToken,
    getDashboardSelectedTenantCookieOptions,
    getDashboardSessionCookieOptions,
} from '@/lib/session';
import { assertDashboardRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }

    return request.headers.get('x-real-ip') ?? 'unknown';

}

function sanitizeNextPath(value: string | null): string {
    if (!value || !value.startsWith('/')) {
        return '/';
    }

    if (value.startsWith('//')) {
        return '/';
    }

    return value;

}

function buildInvalidCredentialsRedirect(
    request: NextRequest,
    nextPath: string,
): NextResponse {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'invalid_credentials');

    if (nextPath !== '/') {
        url.searchParams.set('next', nextPath);
    }

    return NextResponse.redirect(url);

}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const formData = await request.formData();

    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const nextPath = sanitizeNextPath(String(formData.get('next') ?? ''));

    const clientIp = getClientIp(request);

    const rateLimit = await assertDashboardRateLimit({
        key: `dashboard:login:${clientIp}`,
        limit: 10,
        windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
        return buildInvalidCredentialsRedirect(request, nextPath);
    }

    const session = authenticateDashboardLogin(email, password);

    if (!session) {
        return buildInvalidCredentialsRedirect(request, nextPath);
    }

    const token = await createDashboardSessionToken(session);

    const response = NextResponse.redirect(new URL(nextPath, request.url));

    response.cookies.set(DASHBOARD_SESSION_COOKIE, token, {
        ...getDashboardSessionCookieOptions(),
    });

    if (session.role !== 'admin' && session.tenantId) {
        response.cookies.set(DASHBOARD_SELECTED_TENANT_COOKIE, session.tenantId, {
            ...getDashboardSelectedTenantCookieOptions(),
        });
    } else {
        response.cookies.delete(DASHBOARD_SELECTED_TENANT_COOKIE);
    }

    return response;

}