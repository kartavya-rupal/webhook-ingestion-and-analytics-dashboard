import { NextRequest, NextResponse } from 'next/server';
import {
    DASHBOARD_SELECTED_TENANT_COOKIE,
    getDashboardSelectedTenantCookieOptions,
    getDashboardSessionFromRequest,
} from '@/lib/session';

function sanitizeNextPath(value: string | null): string {
    if (!value || !value.startsWith('/')) {
        return '/';
    }

    if (value.startsWith('//')) {
        return '/';
    }

    return value;

}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const session = await getDashboardSessionFromRequest(request);

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (session.role !== 'admin') {
        return NextResponse.json(
            { status: 'error', message: 'Forbidden' },
            { status: 403 },
        );
    }

    const formData = await request.formData();
    const tenantId = String(formData.get('tenantId') ?? '').trim();
    const nextPath = sanitizeNextPath(String(formData.get('next') ?? '/'));

    const response = NextResponse.redirect(new URL(nextPath, request.url));

    if (tenantId) {
        response.cookies.set(
            DASHBOARD_SELECTED_TENANT_COOKIE,
            tenantId,
            getDashboardSelectedTenantCookieOptions(),
        );
    } else {
        response.cookies.delete(DASHBOARD_SELECTED_TENANT_COOKIE);
    }

    return response;

}