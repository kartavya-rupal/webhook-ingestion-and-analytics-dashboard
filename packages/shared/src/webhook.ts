export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-webhook-timestamp';
export const WEBHOOK_ID_HEADER = 'x-webhook-id';

export const WEBHOOK_ALLOWED_CLOCK_SKEW_SECONDS = 300;
export const WEBHOOK_CONTENT_TYPE = 'application/json';

export type WebhookProviderSlug = string;

export type WebhookEnvelope = {
    id: string;
    type: string;
    created_at?: string;
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};