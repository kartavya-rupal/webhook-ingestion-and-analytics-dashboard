export const WEBHOOK_EVENT_STATES = [
    'received',
    'verified',
    'persisted',
    'queued',
    'processing',
    'succeeded',
    'failed_retryable',
    'retry_scheduled',
    'failed_non_retryable',
    'moved_to_dlq',
    'replay_requested',
    'replay_processing',
    'replay_succeeded',
    'replay_failed',
] as const;

export type WebhookEventState = (typeof WEBHOOK_EVENT_STATES)[number];