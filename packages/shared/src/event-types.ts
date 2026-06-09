export const FINRELAY_EVENT_TYPES = [
    'payment.succeeded',
    'payment.failed',
    'refund.created',
    'payout.failed',
    'chargeback.created',
    'settlement.received',
] as const;

export type FinRelayEventType = (typeof FINRELAY_EVENT_TYPES)[number];