import { SendMessageCommand } from '@aws-sdk/client-sqs';
import type { WorkerQueueMessage } from '@finrelay/shared';
import { db, sqs } from './clients';
import { env } from '../config/env';
import {
    calculateRetryDelayMs,
    calculateRetryDelaySeconds,
} from './retry-policy';
import {
    logWithContext,
    observeDbWrite,
    observeWorkerStage,
    recordRetryExhausted,
    recordRetryScheduled,
} from './telemetry';

function reasonFromError(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return 'Unknown processing failure';
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

async function getCurrentAttempt(input: {
    eventId: string;
    attemptNumber: number;
}) {
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

    return attempt;
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

    if (input.attemptNumber >= env.MAX_RETRY_ATTEMPTS) {
        recordRetryExhausted({
            providerSlug: input.queueMessage.providerSlug,
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            reason,
        });

        await handlePoisonFailure({
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            queueMessage: input.queueMessage,
            error: new Error(`Max retry attempts exceeded: ${reason}`),
        });

        return {
            scheduled: false,
            delayMs: 0,
            delaySeconds: 0,
            nextRetryAt: now,
        };
    }

    const attempt = await getCurrentAttempt({
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
    });

    const durationMs = computeDurationMs(attempt.startedAt, now);

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

    await observeDbWrite(
        {
            entity: 'delivery_attempt',
            operation: 'mark_retryable_failed',
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            providerSlug: input.queueMessage.providerSlug,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
        },
        async () =>
            db.$transaction(async (tx) => {
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
            }),
    );

    await observeWorkerStage(
        'worker.retry_schedule',
        {
            providerSlug: input.queueMessage.providerSlug,
            eventId: input.eventId,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
        },
        async () =>
            sqs.send(
                new SendMessageCommand({
                    QueueUrl: env.SQS_MAIN_QUEUE_URL,
                    DelaySeconds: delaySeconds,
                    MessageBody: JSON.stringify(buildRetryMessage(input.queueMessage)),
                }),
            ),
    );

    await observeDbWrite(
        {
            entity: 'delivery_attempt',
            operation: 'mark_retry_scheduled',
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            providerSlug: input.queueMessage.providerSlug,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
        },
        async () =>
            db.$transaction(async (tx) => {
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
            }),
    );

    recordRetryScheduled({
        providerSlug: input.queueMessage.providerSlug,
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
        delayMs,
        nextRetryAt,
    });

    return {
        scheduled: true,
        delayMs,
        delaySeconds,
        nextRetryAt,
    };
}

export async function handleNonRetryableFailure(input: {
    eventId: string;
    attemptNumber: number;
    queueMessage: WorkerQueueMessage;
    error: unknown;
}): Promise<void> {
    const now = new Date();
    const reason = reasonFromError(input.error);
    const attempt = await getCurrentAttempt({
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
    });
    const durationMs = computeDurationMs(attempt.startedAt, now);
    const finalEventStatus = input.queueMessage.isReplay
        ? 'replay_failed'
        : 'failed_non_retryable';

    await observeDbWrite(
        {
            entity: 'delivery_attempt',
            operation: 'mark_non_retryable_failed',
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            providerSlug: input.queueMessage.providerSlug,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
        },
        async () =>
            db.$transaction(async (tx) => {
                await tx.deliveryAttempt.update({
                    where: {
                        eventId_attemptNumber: {
                            eventId: input.eventId,
                            attemptNumber: input.attemptNumber,
                        },
                    },
                    data: {
                        status: 'failed',
                        failureCategory: 'non_retryable',
                        responseCode: null,
                        errorMessage: reason,
                        durationMs,
                        finishedAt: now,
                    },
                });

                await tx.webhookEvent.update({
                    where: { id: input.eventId },
                    data: {
                        status: finalEventStatus,
                        lastFailureReason: reason,
                        lastFailureCategory: 'non_retryable',
                        processingFinishedAt: now,
                        processedAt: now,
                        nextRetryAt: null,
                    },
                });

                if (input.queueMessage.isReplay && input.queueMessage.replayJobId) {
                    await tx.replayJob.update({
                        where: { id: input.queueMessage.replayJobId },
                        data: {
                            replayStatus: 'failed',
                            finishedAt: now,
                        },
                    });
                }
            }),
    );
}

export async function handlePoisonFailure(input: {
    eventId: string;
    attemptNumber: number;
    queueMessage: WorkerQueueMessage;
    error: unknown;
}): Promise<{ dlqSent: boolean }> {
    const now = new Date();
    const reason = reasonFromError(input.error);
    const attempt = await getCurrentAttempt({
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
    });
    const durationMs = computeDurationMs(attempt.startedAt, now);
    const finalEventStatus = input.queueMessage.isReplay
        ? 'replay_failed'
        : 'moved_to_dlq';

    await observeDbWrite(
        {
            entity: 'delivery_attempt',
            operation: 'mark_poison_failed',
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            providerSlug: input.queueMessage.providerSlug,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
        },
        async () =>
            db.$transaction(async (tx) => {
                await tx.deliveryAttempt.update({
                    where: {
                        eventId_attemptNumber: {
                            eventId: input.eventId,
                            attemptNumber: input.attemptNumber,
                        },
                    },
                    data: {
                        status: 'failed',
                        failureCategory: 'poison',
                        responseCode: null,
                        errorMessage: reason,
                        durationMs,
                        finishedAt: now,
                    },
                });

                await tx.webhookEvent.update({
                    where: { id: input.eventId },
                    data: {
                        status: finalEventStatus,
                        lastFailureReason: reason,
                        lastFailureCategory: 'poison',
                        processingFinishedAt: now,
                        processedAt: now,
                        nextRetryAt: null,
                    },
                });

                if (input.queueMessage.isReplay && input.queueMessage.replayJobId) {
                    await tx.replayJob.update({
                        where: { id: input.queueMessage.replayJobId },
                        data: {
                            replayStatus: 'failed',
                            finishedAt: now,
                        },
                    });
                }
            }),
    );

    let dlqSent = false;

    try {
        await observeWorkerStage(
            'worker.dlq_move',
            {
                providerSlug: input.queueMessage.providerSlug,
                eventId: input.eventId,
                tenantId: input.queueMessage.tenantId,
                endpointId: input.queueMessage.endpointId,
            },
            async () =>
                sqs.send(
                    new SendMessageCommand({
                        QueueUrl: env.SQS_DLQ_URL,
                        MessageBody: JSON.stringify({
                            ...input.queueMessage,
                            deadLetteredAtIso: now.toISOString(),
                            deadLetterReason: reason,
                            deadLetterSource: input.queueMessage.isReplay
                                ? 'replay'
                                : 'worker',
                        }),
                    }),
                ),
        );

        dlqSent = true;

        await observeDbWrite(
            {
                entity: 'webhook_event',
                operation: 'mark_dlq_moved',
                eventId: input.eventId,
                providerSlug: input.queueMessage.providerSlug,
                tenantId: input.queueMessage.tenantId,
                endpointId: input.queueMessage.endpointId,
            },
            async () =>
                db.webhookEvent.update({
                    where: { id: input.eventId },
                    data: {
                        dlqMovedAt: now,
                    },
                }),
        );
    } catch (dlqError) {
        logWithContext('error', 'failed to move event to DLQ', {
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            providerSlug: input.queueMessage.providerSlug,
            tenantId: input.queueMessage.tenantId,
            endpointId: input.queueMessage.endpointId,
            reason,
            dlqError:
                dlqError instanceof Error ? dlqError.message : 'Unknown DLQ error',
        });
    }

    return { dlqSent };
}