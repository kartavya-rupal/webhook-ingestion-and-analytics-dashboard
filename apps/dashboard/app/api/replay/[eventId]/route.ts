import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardMutationAccess } from '@/lib/route-guards';
import { getDashboardSelectedTenantId, getDashboardSession } from '@/lib/session';

type RouteContext = {
    params:
    | Promise<{
        eventId: string;
    }>
    | {
        eventId: string;
    };
};

function sanitizeNextPath(value: string | null, fallback: string): string {
    if (!value || !value.startsWith('/')) {
        return fallback;
    }

    if (value.startsWith('//')) {
        return fallback;
    }

    return value;
}

function getApiBaseUrl(): string {
    return (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function redirectWithError(
    request: NextRequest,
    path: string,
    error: string,
): NextResponse {
    const url = new URL(path, request.url);
    url.searchParams.set('error', error);
    return NextResponse.redirect(url);
}

export async function POST(
    request: NextRequest,
    context: RouteContext,
): Promise<NextResponse> {
    const { eventId } = await Promise.resolve(context.params);

    if (!eventId) {
        return redirectWithError(request, '/replay-jobs', 'missing_event');
    }

    const formData = await request.formData().catch(() => null);
    const redirectTo = sanitizeNextPath(
        formData?.get('redirectTo')?.toString() ??
        formData?.get('next')?.toString() ??
        `/events/${eventId}`,
        `/events/${eventId}`,
    );

    const gate = await requireDashboardMutationAccess(request, 'replay');

    if (!gate.ok) {
        return gate.response;
    }

    const session = gate.session;

    const effectiveTenantId =
        session.role === 'admin'
            ? await getDashboardSelectedTenantId()
            : session.tenantId;

    try {
        const apiResponse = await fetch(
            `${getApiBaseUrl()}/api/events/${encodeURIComponent(eventId)}/replay`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-dashboard-user-email': session.email,
                    'x-dashboard-user-name': session.name,
                    'x-dashboard-user-role': session.role,
                    ...(effectiveTenantId
                        ? {
                            'x-dashboard-tenant-id': effectiveTenantId,
                        }
                        : {}),
                },
                body: JSON.stringify({
                    requestedBy: session.email,
                    requestedByName: session.name,
                    requestedByRole: session.role,
                    source: 'dashboard',
                }),
            },
        );

        if (!apiResponse.ok) {
            const body = await apiResponse.text().catch(() => '');
            throw new Error(body || `Replay request failed (${apiResponse.status})`);
        }

        const url = new URL(redirectTo, request.url);
        url.searchParams.set('replay', 'queued');
        url.searchParams.set('eventId', eventId);

        return NextResponse.redirect(url);
    } catch (error) {
        const url = new URL(redirectTo, request.url);
        url.searchParams.set('error', 'replay_failed');

        if (error instanceof Error) {
            url.searchParams.set('reason', error.message);
        }

        return NextResponse.redirect(url);
    }
}

export async function GET(): Promise<NextResponse> {
    return new NextResponse('Method Not Allowed', { status: 405 });
}