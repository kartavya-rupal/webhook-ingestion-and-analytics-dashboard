import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { db, sqs } from './clients';
import { env } from '../config/env';
import {
    logWithContext,
    observeDbWrite,
    observeWorkerStage,
} from './telemetry';
import {
    WORKER_QUEUE_MESSAGE_TYPE,
    WORKER_QUEUE_MESSAGE_VERSION,
    type WorkerQueueMessage,
} from '@finrelay/shared';

const REPLAY_DISPATCH_POLL_INTERVAL_MS = 2000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimNextReplayJob() {
    const job = await db.replayJob.findFirst({
        where: {
            replayStatus: 'requested',
        },
        orderBy: {
            createdAt: 'asc',
        },
        include: {
            event: {
                select: {
                    id: true,
                    tenantId: true,
                    endpointId: true,
                    providerSlug: true,
                    externalEventId: true,
                    eventType: true,
                    payloadPath: true,
                    payloadHash: true,
                },
            },
        },
    });

    if (!job) {
        return null;
    }

    const claimed = await db.replayJob.updateMany({
        where: {
            id: job.id,
            replayStatus: 'requested',
        },
        data: {
            replayStatus: 'processing',
        },
    });

    if (claimed.count !== 1) {
        return null;
    }

    return job;
}

async function failReplayJob(input: {
    jobId: string;
    eventId: string | null;
    tenantId: string | null;
    endpointId: string | null;
    reason: string;
}): Promise<void> {
    const now = new Date();

    await observeDbWrite(
        {
            entity: 'replay_job',
            operation: 'mark_failed',
            eventId: input.eventId ?? undefined,
            tenantId: input.tenantId ?? undefined,
            endpointId: input.endpointId ?? undefined,
        },
        async () =>
            db.$transaction(async (tx) => {
                await tx.replayJob.update({
                    where: {
                        id: input.jobId,
                    },
                    data: {
                        replayStatus: 'failed',
                        finishedAt: now,
                    },
                });

                if (input.eventId) {
                    await tx.webhookEvent.update({
                        where: {
                            id: input.eventId,
                        },
                        data: {
                            status: 'replay_failed',
                            lastFailureReason: input.reason,
                            lastFailureCategory: 'non_retryable',
                            processingFinishedAt: now,
                            processedAt: now,
                        },
                    });
                }
            }),
    );
}

async function dispatchReplayJob(): Promise<boolean> {
    const job = await claimNextReplayJob();

    if (!job) {
        return false;
    }

    if (!job.event) {
        await failReplayJob({
            jobId: job.id,
            eventId: job.eventId,
            tenantId: job.tenantId,
            endpointId: null,
            reason: 'Replay event not found',
        });

        return true;
    }

    const event = job.event;

    if (!event.payloadPath) {
        await failReplayJob({
            jobId: job.id,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            reason: 'Replay payload path missing',
        });

        return true;
    }

    const replayMessage: WorkerQueueMessage = {
        type: WORKER_QUEUE_MESSAGE_TYPE,
        version: WORKER_QUEUE_MESSAGE_VERSION,
        eventId: event.id,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        externalEventId: event.externalEventId ?? '',
        eventType: event.eventType,
        payloadPath: event.payloadPath,
        payloadHash: event.payloadHash,
        queuedAtIso: new Date().toISOString(),
        isReplay: true,
        replayJobId: job.id,
        replayRequestedBy: job.requestedBy ?? null,
    };

    await observeDbWrite(
        {
            entity: 'webhook_event',
            operation: 'mark_replay_processing',
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
        },
        async () =>
            db.webhookEvent.update({
                where: {
                    id: event.id,
                },
                data: {
                    status: 'replay_processing',
                },
            }),
    );

    try {
        await observeWorkerStage(
            'worker.replay_dispatch',
            {
                eventId: event.id,
                tenantId: event.tenantId,
                endpointId: event.endpointId,
                providerSlug: event.providerSlug,
                replayJobId: job.id,
            },
            async () =>
                sqs.send(
                    new SendMessageCommand({
                        QueueUrl: env.SQS_MAIN_QUEUE_URL,
                        MessageBody: JSON.stringify(replayMessage),
                    }),
                ),
        );

        logWithContext('info', 'replay job dispatched', {
            replayJobId: job.id,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
        });

        return true;
    } catch (error) {
        const reason =
            error instanceof Error ? error.message : 'Unknown replay error';

        await failReplayJob({
            jobId: job.id,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            reason,
        });

        logWithContext('error', 'replay dispatch failed', {
            replayJobId: job.id,
            eventId: event.id,
            tenantId: event.tenantId,
            endpointId: event.endpointId,
            providerSlug: event.providerSlug,
            reason,
        });

        return true;
    }
}

export async function startReplayDispatcher(): Promise<void> {
    console.log('[worker] replay dispatcher started');

    while (true) {
        try {
            const dispatched = await dispatchReplayJob();

            if (!dispatched) {
                await sleep(REPLAY_DISPATCH_POLL_INTERVAL_MS);
            }
        } catch (error) {
            logWithContext('error', 'replay dispatcher loop failed', {
                reason: error instanceof Error ? error.message : 'Unknown error',
            });

            await sleep(REPLAY_DISPATCH_POLL_INTERVAL_MS);
        }
    }
}