import {
    getDashboardSession,
    getDashboardSelectedTenantId,
} from './session';

export type AnalyticsQueryParams = {
    range?: '24h' | '7d' | '30d' | '90d';
    from?: string;
    to?: string;
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    eventType?: string;
    status?: string;
};

export type AnalyticsSummary = {
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    dlqEvents: number;
    replayRequests: number;
    replaySucceeded: number;
    replayFailed: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    successRate: number;
    failureRate: number;
    retryRate: number;
    dlqRate: number;
    replaySuccessRate: number;
};

export type AnalyticsTrendPoint = {
    bucketStartUtc: string;
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    dlqEvents: number;
    replayRequests: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
};

export type AnalyticsEndpointPoint = {
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    dlqEvents: number;
    retryCount: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    failureRate: number;
};

export type AnalyticsEventTypePoint = {
    eventType: string;
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    nonRetryableFailures: number;
    dlqEvents: number;
    retryCount: number;
    replayRequests: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    failureRate: number;
};

export type AnalyticsReplayPoint = {
    bucketStartUtc: string;
    totalReplayJobs: number;
    replayRequested: number;
    replayProcessing: number;
    replaySucceeded: number;
    replayFailed: number;
    replayLatencyMs: number;
};

export type AnalyticsOverview = {
    summary: AnalyticsSummary;
    trends: AnalyticsTrendPoint[];
    endpoints: AnalyticsEndpointPoint[];
    eventTypes: AnalyticsEventTypePoint[];
    replays: AnalyticsReplayPoint[];
};

function getApiBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

async function analyticsFetchJson<T>(path: string): Promise<T> {
    const session = await getDashboardSession();

    if (!session) {
        throw new Error('Dashboard session missing');
    }

    const effectiveTenantId =
        session.role === 'admin'
            ? await getDashboardSelectedTenantId()
            : session.tenantId;

    const response = await fetch(
        `${getApiBaseUrl()}${path}`,
        {
            cache: 'no-store',
            headers: {
                'x-dashboard-user-email': session.email,
                'x-dashboard-user-name': session.name,
                'x-dashboard-user-role': session.role,

                ...(effectiveTenantId
                    ? {
                        'x-dashboard-tenant-id': effectiveTenantId,
                    }
                    : {}),
            },
        },
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload &&
                typeof payload === 'object' &&
                'message' in payload
                ? String(
                    (payload as Record<string, unknown>).message,
                )
                : `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    return payload as T;
}

export async function getAnalyticsOverview(
    params: AnalyticsQueryParams = {},
): Promise<AnalyticsOverview> {
    const searchParams = new URLSearchParams();

    if (params.range) searchParams.set('range', params.range);
    if (params.from) searchParams.set('from', params.from);
    if (params.to) searchParams.set('to', params.to);
    if (params.tenantId) searchParams.set('tenantId', params.tenantId);
    if (params.endpointId) searchParams.set('endpointId', params.endpointId);
    if (params.providerSlug) searchParams.set('providerSlug', params.providerSlug);
    if (params.eventType) searchParams.set('eventType', params.eventType);
    if (params.status) searchParams.set('status', params.status);

    const query = searchParams.toString();

    return analyticsFetchJson<AnalyticsOverview>(
        `/api/analytics/overview${query ? `?${query}` : ''}`,
    );
}