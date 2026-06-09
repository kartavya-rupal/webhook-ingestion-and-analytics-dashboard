export type TenantStatus = 'active' | 'suspended' | 'archived';
export type EndpointStatus = 'active' | 'paused' | 'disabled';
export type WebhookEventStatus =
    | 'received'
    | 'verified'
    | 'persisted'
    | 'queued'
    | 'processing'
    | 'succeeded'
    | 'failed_retryable'
    | 'retry_scheduled'
    | 'failed_non_retryable'
    | 'moved_to_dlq'
    | 'replay_requested'
    | 'replay_processing'
    | 'replay_succeeded'
    | 'replay_failed';

export type DashboardLatestEventSummary = {
    receivedAt: string;
    status: WebhookEventStatus | string;
    eventType: string;
};

export type TenantListItem = {
    id: string;
    name: string;
    status: TenantStatus;
    createdAt: string;
    updatedAt: string;
    endpointCount: number;
    eventCount: number;
    latestEvent: DashboardLatestEventSummary | null;
};

export type TenantSummary = {
    tenantId: string;
    endpointCount: number;
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    dlqEvents: number;
    latestEvent: DashboardLatestEventSummary | null;
};

export type TenantDetail = {
    tenant: {
        id: string;
        name: string;
        status: TenantStatus;
        createdAt: string;
        updatedAt: string;
        endpoints: Array<{
            id: string;
            tenantId: string;
            providerSlug: string;
            name: string;
            url: string;
            status: EndpointStatus;
            createdAt: string;
            updatedAt: string;
        }>;
    };
};

export type EndpointListItem = {
    id: string;
    tenantId: string;
    providerSlug: string;
    name: string;
    url: string;
    status: EndpointStatus;
    retryPolicy: unknown | null;
    createdAt: string;
    updatedAt: string;
    eventCount: number;
    failureCount: number;
    latestEvent: DashboardLatestEventSummary | null;
};

export type EndpointDetail = {
    endpoint: {
        id: string;
        tenantId: string;
        providerSlug: string;
        name: string;
        url: string;
        status: EndpointStatus;
        eventFilters: unknown;
        signingSecretReference: string | null;
        retryPolicy: unknown;
        createdAt: string;
        updatedAt: string;
        tenant: {
            id: string;
            name: string;
            status: TenantStatus;
        };
    };
};

export type EventListItem = {
    id: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string | null;
    eventType: string;
    payloadPath: string;
    payloadHash: string;
    status: WebhookEventStatus | string;
    receivedAt: string;
    lastUpdatedAt: string;
    attemptCount: number;
    processedAt: string | null;
    replayCount: number;
    tenant?: {
        id: string;
        name: string;
    };
    endpoint?: {
        id: string;
        name: string;
        providerSlug: string;
    };
    dedupeKey: string;
};

export type EventDetail = {
    event: EventListItem & {
        rawPayloadSize: number | null;
        requestHeaders: Record<string, unknown> | null;
        requestIp: string | null;
        signatureVerifiedAt: string | null;
        queuedAt: string | null;
        queueMessageId: string | null;
        processingStartedAt: string | null;
        processingFinishedAt: string | null;
        lastAttemptNumber: number;
        lastFailureReason: string | null;
        lastFailureCategory: string | null;
        nextRetryAt: string | null;
        dlqMovedAt: string | null;
        attempts: Array<{
            id: string;
            eventId: string;
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
        }>;
    };
};

export type DlqListItem = EventListItem & {
    dlqMovedAt: string | null;
    lastFailureReason: string | null;
    lastFailureCategory: string | null;
};

export type ReplayJobListItem = {
    id: string;
    tenantId: string;
    eventId: string | null;
    requestedBy: string | null;
    replayStatus: 'requested' | 'processing' | 'succeeded' | 'failed' | string;
    createdAt: string;
    finishedAt: string | null;
    tenant?: {
        id: string;
        name: string;
    };
    event?: {
        id: string;
        eventType: string;
        status: string;
    } | null;
};

export type DashboardOverview = {
    tenants: TenantListItem[];
    activeTenant: TenantListItem | null;
    summary: TenantSummary | null;
    endpoints: EndpointListItem[];
    recentEvents: EventListItem[];
    recentFailures: EventListItem[];
};