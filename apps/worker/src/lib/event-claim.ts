import os from 'node:os';
import { db, redis } from './clients';
import {
    logWithContext,
    observeDbWrite,
    observeWorkerStage,
    recordWorkerClaimOutcome,
} from './telemetry';

const PROCESSING_LOCK_TTL_SECONDS = 300;

const CLAIMABLE_STATUSES = [
    'queued',
    'retry_scheduled',
    'failed_retryable',
    'replay_requested',
    'replay_processing',
] as const;

const TERMINAL_STATUSES = [
    'succeeded',
    'failed_non_retryable',
    'moved_to_dlq',
    'replay_succeeded',
    'replay_failed',
] as const;

type ClaimResult =
    | { claimed: true; attemptNumber: number }
    | {
        claimed: false;
        reason: 'missing' | 'terminal' | 'already_processing' | 'not_claimable';
    };

export async function claimEventForProcessing(input: {
    eventId: string;
    isReplay: boolean;
}): Promise<ClaimResult> {
    return observeWorkerStage(
        'worker.claim',
        {
            eventId: input.eventId,
        },
        async () => {
            const lockKey = `finrelay:worker:processing:${input.eventId}`;
            const lockValue = `${os.hostname()}:${process.pid}`;

            const lockAcquired = await observeWorkerStage(
                'worker.claim_lock',
                {
                    eventId: input.eventId,
                },
                async () =>
                    redis.set(
                        lockKey,
                        lockValue,
                        'EX',
                        PROCESSING_LOCK_TTL_SECONDS,
                        'NX',
                    ),
            );

            if (lockAcquired !== 'OK') {
                recordWorkerClaimOutcome({
                    outcome: 'already_processing',
                    eventId: input.eventId,
                });

                return { claimed: false, reason: 'already_processing' };
            }

            try {
                const event = await db.webhookEvent.findUnique({
                    where: { id: input.eventId },
                });

                if (!event) {
                    recordWorkerClaimOutcome({
                        outcome: 'missing',
                        eventId: input.eventId,
                    });

                    return { claimed: false, reason: 'missing' };
                }

                if (TERMINAL_STATUSES.includes(event.status as never)) {
                    recordWorkerClaimOutcome({
                        outcome: 'terminal',
                        eventId: input.eventId,
                    });

                    return { claimed: false, reason: 'terminal' };
                }

                if (event.status === 'processing') {
                    recordWorkerClaimOutcome({
                        outcome: 'already_processing',
                        eventId: input.eventId,
                    });

                    return { claimed: false, reason: 'already_processing' };
                }

                if (!CLAIMABLE_STATUSES.includes(event.status as never)) {
                    recordWorkerClaimOutcome({
                        outcome: 'not_claimable',
                        eventId: input.eventId,
                    });

                    return { claimed: false, reason: 'not_claimable' };
                }

                const nextAttemptNumber = event.lastAttemptNumber + 1;
                const now = new Date();
                const nextStatus = input.isReplay ? 'replay_processing' : 'processing';

                const updated = await observeDbWrite(
                    {
                        entity: 'webhook_event',
                        operation: 'claim_for_processing',
                        eventId: input.eventId,
                        tenantId: event.tenantId,
                        endpointId: event.endpointId,
                    },
                    async () =>
                        db.$transaction(async (tx) => {
                            const claim = await tx.webhookEvent.updateMany({
                                where: {
                                    id: input.eventId,
                                    status: {
                                        in: [
                                            'queued',
                                            'retry_scheduled',
                                            'failed_retryable',
                                            'replay_requested',
                                            'replay_processing',
                                        ],
                                    },
                                },
                                data: {
                                    status: nextStatus,
                                    processingStartedAt: now,
                                    lastAttemptNumber: nextAttemptNumber,
                                },
                            });

                            if (claim.count !== 1) {
                                return false;
                            }

                            await tx.deliveryAttempt.create({
                                data: {
                                    eventId: input.eventId,
                                    attemptNumber: nextAttemptNumber,
                                    status: 'pending',
                                    startedAt: now,
                                    workerName: os.hostname(),
                                },
                            });

                            return true;
                        }),
                );

                if (!updated) {
                    recordWorkerClaimOutcome({
                        outcome: 'already_processing',
                        eventId: input.eventId,
                    });

                    return { claimed: false, reason: 'already_processing' };
                }

                recordWorkerClaimOutcome({
                    outcome: 'claimed',
                    eventId: input.eventId,
                });

                return {
                    claimed: true,
                    attemptNumber: nextAttemptNumber,
                };
            } catch (error) {
                logWithContext('error', 'worker claim failed', {
                    eventId: input.eventId,
                    reason:
                        error instanceof Error
                            ? error.message
                            : 'Unknown claim error',
                });

                throw error;
            } finally {
                await redis.del(lockKey).catch(() => undefined);
            }
        },
    );
}