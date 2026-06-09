export const DELIVERY_FAILURE_CATEGORIES = [
    'retryable',
    'non_retryable',
    'poison',
] as const;

export type DeliveryFailureCategory = (typeof DELIVERY_FAILURE_CATEGORIES)[number];

export class RetryableProcessingError extends Error {
    readonly category = 'retryable' as const;
}

export class NonRetryableProcessingError extends Error {
    readonly category = 'non_retryable' as const;
}

export class PoisonProcessingError extends Error {
    readonly category = 'poison' as const;
}

export type DeliveryFailureClassification = {
    category: DeliveryFailureCategory;
    shouldRetry: boolean;
    shouldMoveToDlq: boolean;
    reason: string;
};

function reasonFromError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'Unknown processing failure';
}

export function classifyDeliveryFailure(error: unknown): DeliveryFailureClassification {
    if (error instanceof PoisonProcessingError) {
        return {
            category: 'poison',
            shouldRetry: false,
            shouldMoveToDlq: true,
            reason: reasonFromError(error),
        };
    }

    if (error instanceof NonRetryableProcessingError) {
        return {
            category: 'non_retryable',
            shouldRetry: false,
            shouldMoveToDlq: false,
            reason: reasonFromError(error),
        };
    }

    if (error instanceof RetryableProcessingError) {
        return {
            category: 'retryable',
            shouldRetry: true,
            shouldMoveToDlq: false,
            reason: reasonFromError(error),
        };
    }

    return {
        category: 'retryable',
        shouldRetry: true,
        shouldMoveToDlq: false,
        reason: reasonFromError(error),
    };
}