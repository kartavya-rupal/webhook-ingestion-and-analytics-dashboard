import {
    DASHBOARD_SELECTED_TENANT_COOKIE,
    DASHBOARD_SESSION_COOKIE,
    getDashboardSessionCookieOptions,
    getDashboardSelectedTenantCookieOptions,
} from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

function buildLogoutResponse(request: NextRequest): NextResponse {
    const response = NextResponse.redirect(new URL('/login', request.url));

    response.cookies.set(DASHBOARD_SESSION_COOKIE, '', {
        ...getDashboardSessionCookieOptions(),
        maxAge: 0,
        expires: new Date(0),
    });

    response.cookies.set(DASHBOARD_SELECTED_TENANT_COOKIE, '', {
        ...getDashboardSelectedTenantCookieOptions(),
        maxAge: 0,
        expires: new Date(0),
    });

    return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    return buildLogoutResponse(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    return buildLogoutResponse(request);
}