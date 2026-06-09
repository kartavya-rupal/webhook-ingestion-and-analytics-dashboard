import { dashboardEnv } from './env';
import {
    type DashboardOverview,
    type DlqListItem,
    type EndpointDetail,
    type EndpointListItem,
    type EventDetail,
    type EventListItem,
    type ReplayJobListItem,
    type TenantDetail,
    type TenantListItem,
    type TenantSummary,
} from './types';
import {
    getDashboardSelectedTenantId,
    getDashboardSession,
} from './session';

type JsonValue = unknown;

export type ApiHealth = {
    status: string;
    service: string;
    app: string;
    environment: string;
    timestamp: string;
    uptimeSeconds: number;
};

export async function getApiHealth(): Promise<ApiHealth | null> {
    try {
        const res = await fetch(`${dashboardEnv.NEXT_PUBLIC_API_URL}/health`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch {
        return null;
    }
}

export class DashboardApiError extends Error {
    status: number;
    body: JsonValue;

    constructor(message: string, status: number, body: JsonValue) {
        super(message);
        this.name = 'DashboardApiError';
        this.status = status;
        this.body = body;
    }

}

function getApiBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return url.replace(/\/$/, '');
}

async function getEffectiveTenantId(): Promise<string | null> {
    const session = await getDashboardSession();

    if (!session) {
        return null;
    }

    if (session.role === 'admin') {
        return await getDashboardSelectedTenantId();
    }

    return session.tenantId;

}

type DashboardFetchOptions = {
    cookieHeader?: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
};

async function dashboardFetchJson<T>(
    path: string,
    options: DashboardFetchOptions = {},
): Promise<T> {
    const session = await getDashboardSession();
    const effectiveTenantId = await getEffectiveTenantId();

    const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
        method: options.method ?? 'GET',
        cache: 'no-store',
        headers: {
            'content-type': 'application/json',
            ...(session
                ? {
                    'x-dashboard-user-email': session.email,
                    'x-dashboard-user-name': session.name,
                    'x-dashboard-user-role': session.role,
                }
                : {}),
            ...(effectiveTenantId
                ? {
                    'x-dashboard-tenant-id': effectiveTenantId,
                }
                : {}),
            ...(options.cookieHeader ? { cookie: options.cookieHeader } : {}),
            ...(options.headers ?? {}),
        },
        body:
            options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

    if (!response.ok) {
        const message =
            typeof payload === 'object' && payload && 'message' in payload
                ? String((payload as Record<string, unknown>).message)
                : `Request failed with status ${response.status}`;

        throw new DashboardApiError(message, response.status, payload);
    }

    return payload as T;

}

export async function getTenants(): Promise<{ items: TenantListItem[] }> {
    return dashboardFetchJson<{ items: TenantListItem[] }>('/api/tenants');
}

export async function getTenant(tenantId: string): Promise<TenantDetail> {
    return dashboardFetchJson<TenantDetail>(`/api/tenants/${tenantId}`);
}

export async function getTenantSummary(
    tenantId: string,
): Promise<TenantSummary> {
    return dashboardFetchJson<TenantSummary>(`/api/tenants/${tenantId}/summary`);
}

export async function getEndpoints(): Promise<{ items: EndpointListItem[] }> {
    return dashboardFetchJson<{ items: EndpointListItem[] }>('/api/endpoints');
}

export async function getEndpoint(endpointId: string): Promise<EndpointDetail> {
    return dashboardFetchJson<EndpointDetail>(`/api/endpoints/${endpointId}`);
}

export async function getEvents(params: {
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{
    items: EventListItem[];
    page: { limit: number; offset: number; total: number };
}> {
    const searchParams = new URLSearchParams();

    if (params.tenantId) searchParams.set('tenantId', params.tenantId);
    if (params.endpointId) searchParams.set('endpointId', params.endpointId);
    if (params.providerSlug) searchParams.set('providerSlug', params.providerSlug);
    if (params.status) searchParams.set('status', params.status);
    if (params.q) searchParams.set('q', params.q);
    if (params.from) searchParams.set('from', params.from);
    if (params.to) searchParams.set('to', params.to);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return dashboardFetchJson(`/api/events${query ? `?${query}` : ''}`);

}

export async function getEvent(eventId: string): Promise<EventDetail> {
    return dashboardFetchJson<EventDetail>(`/api/events/${eventId}`);
}

export async function getEventAttempts(eventId: string): Promise<{
    items: EventDetail['event']['attempts'];
}> {
    return dashboardFetchJson<{ items: EventDetail['event']['attempts'] }>(
        `/api/events/${eventId}/attempts`,
    );
}

export async function getDlqItems(params: {
    tenantId?: string;
    providerSlug?: string;
    status?: string;
    q?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{
    items: DlqListItem[];
    page: { limit: number; offset: number; total: number };
}> {
    const searchParams = new URLSearchParams();

    if (params.tenantId) searchParams.set('tenantId', params.tenantId);
    if (params.providerSlug) searchParams.set('providerSlug', params.providerSlug);
    if (params.status) searchParams.set('status', params.status);
    if (params.q) searchParams.set('q', params.q);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return dashboardFetchJson(`/api/dlq${query ? `?${query}` : ''}`);

}

export async function getDlqEvent(eventId: string): Promise<{
    event: EventDetail['event'];
}> {
    return dashboardFetchJson<{ event: EventDetail['event'] }>(
        `/api/dlq/${eventId}`,
    );
}

export async function getReplayJobs(): Promise<{
    items: ReplayJobListItem[];
}> {
    return dashboardFetchJson<{ items: ReplayJobListItem[] }>('/api/replay-jobs');
}

export async function triggerReplay(eventId: string, requestedBy?: string) {
    return dashboardFetchJson<{ status: string; replayJob: ReplayJobListItem }>(
        `/api/events/${eventId}/replay`,
        {
            method: 'POST',
            body: requestedBy ? { requestedBy } : {},
        },
    );
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
    const tenantsResponse = await getTenants();
    const tenants = tenantsResponse.items;
    const session = await getDashboardSession();
    const selectedTenantId =
        session?.role === 'admin'
            ? await getDashboardSelectedTenantId()
            : session?.tenantId ?? null;

    const activeTenant =
        selectedTenantId
            ? tenants.find((tenant) => tenant.id === selectedTenantId) ?? null
            : null;

    if (!activeTenant) {
        return {
            tenants,
            activeTenant: null,
            summary: null,
            endpoints: [],
            recentEvents: [],
            recentFailures: [],
        };
    }

    const [summary, endpointsResponse, eventsResponse] = await Promise.all([
        getTenantSummary(activeTenant.id),
        getEndpoints(),
        getEvents({
            tenantId: activeTenant.id,
            limit: 20,
        }),
    ]);

    const endpoints = endpointsResponse.items.filter(
        (endpoint) => endpoint.tenantId === activeTenant.id,
    );

    const recentEvents = eventsResponse.items.filter(
        (event) => event.tenantId === activeTenant.id,
    );

    const recentFailures = recentEvents.filter((event) =>
        [
            'failed_retryable',
            'retry_scheduled',
            'failed_non_retryable',
            'moved_to_dlq',
            'replay_failed',
        ].includes(event.status),
    );

    return {
        tenants,
        activeTenant,
        summary,
        endpoints,
        recentEvents,
        recentFailures,
    };

}