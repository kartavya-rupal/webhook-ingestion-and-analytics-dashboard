import {
    getDashboardSession,
    getDashboardSelectedTenantId,
} from './session';

export type SearchKind =
    | 'events'
    | 'attempts'
    | 'replays'
    | 'logs'
    | 'payloads';

export type SearchSort = 'newest' | 'oldest' | 'relevance';

export type TimeRangePreset =
    | '15m'
    | '1h'
    | 'today'
    | 'yesterday'
    | '7d'
    | 'custom';

export type SearchQueryParams = {
    kind?: SearchKind;
    q?: string;
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    status?: string;
    range?: TimeRangePreset;
    from?: string;
    to?: string;
    sort?: SearchSort;
    limit?: number;
    offset?: number;
};

export type SearchPage<T> = {
    items: T[];
    page: {
        limit: number;
        offset: number;
        total: number;
    };
};

export type SearchEventItem = {
    id: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    status: string;
    receivedAt: string;
    processedAt: string | null;
    lastUpdatedAt: string;
    replayCount: number;
    attemptCount: number;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
    dedupeKey: string;
    payloadPath: string;
    payloadHash: string;
    requestIp: string | null;
};

export type SearchAttemptItem = {
    id: string;
    eventId: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    attemptNumber: number;
    status: string;
    failureCategory: string | null;
    responseCode: number | null;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    nextRetryAt: string | null;
    workerName: string | null;
    createdAt: string;
    eventType: string;
    externalEventId: string | null;
};

export type SearchReplayItem = {
    id: string;
    eventId: string | null;
    tenantId: string;
    tenantName: string;
    endpointId: string | null;
    endpointName: string | null;
    providerSlug: string | null;
    eventType: string | null;
    requestedBy: string | null;
    replayStatus: string;
    createdAt: string;
    finishedAt: string | null;
};

export type SearchLogItem = {
    id: string;
    timestamp: string;
    service: 'api' | 'worker' | 'dashboard';
    level: 'info' | 'warn' | 'error';
    message: string;
    eventId: string | null;
    tenantId: string | null;
    tenantName: string | null;
    endpointId: string | null;
    endpointName: string | null;
    providerSlug: string | null;
    attemptNumber: number | null;
    replayJobId: string | null;
    errorMessage: string | null;
};

export type SearchPayloadItem = {
    id: string;
    eventId: string;
    tenantId: string;
    tenantName: string;
    endpointId: string;
    endpointName: string;
    providerSlug: string;
    eventType: string;
    externalEventId: string | null;
    status: string;
    receivedAt: string;
    payloadPath: string;
    payloadHash: string;
    dedupeKey: string;
    payloadPreview: string;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
};

export type SearchSuggestions = {
    items: string[];
};

function toUtcIsoDate(date: Date): string {
    return date.toISOString();
}

function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
    );
}

export function resolveTimeRange(
    range: TimeRangePreset | undefined,
    now = new Date(),
): { from?: string; to?: string } {
    const to = toUtcIsoDate(now);

    switch (range) {
        case '15m':
            return { from: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), to };
        case '1h':
            return { from: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), to };
        case 'today':
            return { from: startOfUtcDay(now).toISOString(), to };
        case 'yesterday': {
            const end = startOfUtcDay(now);
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            return { from: start.toISOString(), to: end.toISOString() };
        }
        case '7d':
            return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to };
        case 'custom':
        default:
            return {};
    }
}

function getApiBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function buildQueryString(params: SearchQueryParams): string {
    const searchParams = new URLSearchParams();

    if (params.kind) searchParams.set('kind', params.kind);
    if (params.q) searchParams.set('q', params.q);
    if (params.tenantId) searchParams.set('tenantId', params.tenantId);
    if (params.endpointId) searchParams.set('endpointId', params.endpointId);
    if (params.providerSlug) searchParams.set('providerSlug', params.providerSlug);
    if (params.status) searchParams.set('status', params.status);
    if (params.range) searchParams.set('range', params.range);
    if (params.from) searchParams.set('from', params.from);
    if (params.to) searchParams.set('to', params.to);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));

    return searchParams.toString();
}

async function searchFetchJson<T>(path: string): Promise<T> {
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

export async function getSearchEvents(params: SearchQueryParams): Promise<SearchPage<SearchEventItem>> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchPage<SearchEventItem>>(
        `/api/search/events${query ? `?${query}` : ''}`,
    );
}

export async function getSearchAttempts(params: SearchQueryParams): Promise<SearchPage<SearchAttemptItem>> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchPage<SearchAttemptItem>>(
        `/api/search/attempts${query ? `?${query}` : ''}`,
    );
}

export async function getSearchReplays(params: SearchQueryParams): Promise<SearchPage<SearchReplayItem>> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchPage<SearchReplayItem>>(
        `/api/search/replays${query ? `?${query}` : ''}`,
    );
}

export async function getSearchLogs(params: SearchQueryParams): Promise<SearchPage<SearchLogItem>> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchPage<SearchLogItem>>(
        `/api/search/logs${query ? `?${query}` : ''}`,
    );
}

export async function getSearchPayloads(params: SearchQueryParams): Promise<SearchPage<SearchPayloadItem>> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchPage<SearchPayloadItem>>(
        `/api/search/payloads${query ? `?${query}` : ''}`,
    );
}

export async function getSearchSuggestions(params: SearchQueryParams): Promise<SearchSuggestions> {
    const query = buildQueryString(params);
    return searchFetchJson<SearchSuggestions>(
        `/api/search/suggestions${query ? `?${query}` : ''}`,
    );
}