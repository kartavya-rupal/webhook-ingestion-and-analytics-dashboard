import { NextRequest, NextResponse } from 'next/server';
import { DASHBOARD_SESSION_COOKIE, verifyDashboardSessionToken } from './lib/session';


async function hasValidSession(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;

    if (!token) {
        return false;
    }

    const session = await verifyDashboardSessionToken(token);
    return session !== null;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith('/api/auth/')) {
        return NextResponse.next();
    }

    if (pathname === '/login') {
        const authed = await hasValidSession(request);

        if (authed) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        return NextResponse.next();
    }

    const authed = await hasValidSession(request);

    if (!authed) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};