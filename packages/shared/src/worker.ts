export const WORKER_QUEUE_MESSAGE_TYPE = 'finrelay.webhook_event' as const;
export const WORKER_QUEUE_MESSAGE_VERSION = 1 as const;

export type WorkerQueueMessage = {
    type: typeof WORKER_QUEUE_MESSAGE_TYPE;
    version: typeof WORKER_QUEUE_MESSAGE_VERSION;
    eventId: string;
    tenantId: string;
    endpointId: string;
    providerSlug: string;
    externalEventId: string;
    eventType: string;
    payloadPath: string;
    payloadHash: string;
    queuedAtIso: string;
    isReplay?: boolean;
    replayJobId?: string | null;
    replayRequestedBy?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isOptionalBoolean(value: unknown): boolean {
    return value === undefined || typeof value === 'boolean';
}

function isOptionalStringOrNull(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'string';
}

export function isWorkerQueueMessage(value: unknown): value is WorkerQueueMessage {
    if (!isObject(value)) return false;

    return (
        value.type === WORKER_QUEUE_MESSAGE_TYPE &&
        value.version === WORKER_QUEUE_MESSAGE_VERSION &&
        typeof value.eventId === 'string' &&
        typeof value.tenantId === 'string' &&
        typeof value.endpointId === 'string' &&
        typeof value.providerSlug === 'string' &&
        typeof value.externalEventId === 'string' &&
        typeof value.eventType === 'string' &&
        typeof value.payloadPath === 'string' &&
        typeof value.payloadHash === 'string' &&
        typeof value.queuedAtIso === 'string' &&
        isOptionalBoolean(value.isReplay) &&
        isOptionalStringOrNull(value.replayJobId) &&
        isOptionalStringOrNull(value.replayRequestedBy)
    );
}

export function parseWorkerQueueMessage(raw: string): WorkerQueueMessage {
    const parsed = JSON.parse(raw) as unknown;

    if (!isWorkerQueueMessage(parsed)) {
        throw new Error('Invalid worker queue message');
    }

    return parsed;
}