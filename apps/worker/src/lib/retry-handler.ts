import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { db, sqs } from './clients';
import { env } from '../config/env';
import {
    calculateRetryDelayMs,
    calculateRetryDelaySeconds,
} from './retry-policy';
import type { WorkerQueueMessage } from '@finrelay/shared';

function reasonFromError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'Unknown retryable failure';
}

function computeDurationMs(startedAt: Date | null | undefined, now: Date): number {
    if (!startedAt) return 0;
    return Math.max(0, now.getTime() - startedAt.getTime());
}

function buildRetryMessage(message: WorkerQueueMessage): WorkerQueueMessage {
    return {
        ...message,
        queuedAtIso: new Date().toISOString(),
    };
}

export async function handleRetryableFailure(input: {
    eventId: string;
    attemptNumber: number;
    queueMessage: WorkerQueueMessage;
    error: unknown;
}): Promise<{
    scheduled: boolean;
    delayMs: number;
    delaySeconds: number;
    nextRetryAt: Date;
}> {
    const now = new Date();
    const reason = reasonFromError(input.error);

    const attempt = await db.deliveryAttempt.findUnique({
        where: {
            eventId_attemptNumber: {
                eventId: input.eventId,
                attemptNumber: input.attemptNumber,
            },
        },
    });

    if (!attempt) {
        throw new Error(
            `DeliveryAttempt not found for ${input.eventId} attempt #${input.attemptNumber}`,
        );
    }

    const durationMs = computeDurationMs(attempt.startedAt, now);

    if (input.attemptNumber >= env.MAX_RETRY_ATTEMPTS) {
        return {
            scheduled: false,
            delayMs: 0,
            delaySeconds: 0,
            nextRetryAt: now,
        };
    }

    const delayMs = calculateRetryDelayMs(
        input.attemptNumber,
        env.RETRY_BACKOFF_BASE_MS,
        env.RETRY_BACKOFF_MAX_MS,
    );

    const delaySeconds = calculateRetryDelaySeconds(
        input.attemptNumber,
        env.RETRY_BACKOFF_BASE_MS,
        env.RETRY_BACKOFF_MAX_MS,
    );

    const nextRetryAt = new Date(now.getTime() + delayMs);

    await db.$transaction(async (tx) => {
        await tx.deliveryAttempt.update({
            where: {
                eventId_attemptNumber: {
                    eventId: input.eventId,
                    attemptNumber: input.attemptNumber,
                },
            },
            data: {
                status: 'failed',
                failureCategory: 'retryable',
                responseCode: null,
                errorMessage: reason,
                durationMs,
                finishedAt: now,
                nextRetryAt,
            },
        });

        await tx.webhookEvent.update({
            where: { id: input.eventId },
            data: {
                status: 'failed_retryable',
                lastFailureReason: reason,
                lastFailureCategory: 'retryable',
                nextRetryAt,
                processingFinishedAt: now,
            },
        });
    });

    await sqs.send(
        new SendMessageCommand({
            QueueUrl: env.SQS_MAIN_QUEUE_URL,
            DelaySeconds: delaySeconds,
            MessageBody: JSON.stringify(buildRetryMessage(input.queueMessage)),
        }),
    );

    await db.$transaction(async (tx) => {
        await tx.deliveryAttempt.update({
            where: {
                eventId_attemptNumber: {
                    eventId: input.eventId,
                    attemptNumber: input.attemptNumber,
                },
            },
            data: {
                status: 'retry_scheduled',
            },
        });

        await tx.webhookEvent.update({
            where: { id: input.eventId },
            data: {
                status: 'retry_scheduled',
            },
        });
    });

    return {
        scheduled: true,
        delayMs,
        delaySeconds,
        nextRetryAt,
    };
}