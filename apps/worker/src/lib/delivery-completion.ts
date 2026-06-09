import { db } from './clients';
import { logWithContext, observeDbWrite } from './telemetry';

export async function markDeliveryAttemptSucceeded(input: {
    eventId: string;
    attemptNumber: number;
    durationMs: number;
    isReplay?: boolean;
    replayJobId?: string | null;
}): Promise<void> {
    const now = new Date();
    const finalEventStatus = input.isReplay ? 'replay_succeeded' : 'succeeded';

    try {
        await observeDbWrite(
            {
                entity: 'delivery_attempt',
                operation: 'mark_succeeded',
                eventId: input.eventId,
                attemptNumber: input.attemptNumber,
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
                            status: 'succeeded',
                            responseCode: 200,
                            durationMs: input.durationMs,
                            finishedAt: now,
                            errorMessage: null,
                            failureCategory: null,
                            nextRetryAt: null,
                        },
                    });

                    await tx.webhookEvent.update({
                        where: { id: input.eventId },
                        data: {
                            status: finalEventStatus,
                            processingFinishedAt: now,
                            processedAt: now,
                            lastFailureReason: null,
                            lastFailureCategory: null,
                            nextRetryAt: null,
                            dlqMovedAt: null,
                        },
                    });

                    if (input.isReplay && input.replayJobId) {
                        await tx.replayJob.update({
                            where: { id: input.replayJobId },
                            data: {
                                replayStatus: 'succeeded',
                                finishedAt: now,
                            },
                        });
                    }
                }),
        );
    } catch (error) {
        logWithContext('error', 'failed to mark delivery attempt succeeded', {
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
            errorCategory: 'delivery_success_write_failure',
            reason: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
    }
}