import { performance } from 'node:perf_hooks';
import {
    DeleteMessageCommand,
    ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';

import { env } from '../config/env';
import { sqs } from './clients';
import { readWorkerQueueMessage } from './queue-message';
import { claimEventForProcessing } from './event-claim';
import { processClaimedEvent } from './event-processor';
import { classifyWorkerFailure } from './failure-classification';

import {
    handlePoisonFailure,
    handleNonRetryableFailure,
    handleRetryableFailure,
} from './delivery-failure-handlers';

import {
    logWithContext,
    observeWorkerStage,
    recordQueueAck,
    recordQueueConsume,
    recordWorkerProcessingOutcome,
} from './telemetry';

const WORKER_POLL_WAIT_SECONDS = 20;
const WORKER_VISIBILITY_TIMEOUT_SECONDS = 60;

async function deleteQueueMessage(receiptHandle: string): Promise<void> {
    await observeWorkerStage(
        'queue.ack',
        {
            queueName: env.SQS_MAIN_QUEUE_URL,
        },
        async () =>
            sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: env.SQS_MAIN_QUEUE_URL,
                    ReceiptHandle: receiptHandle,
                }),
            ),
    );
}

function computeQueueLagMs(message: {
    Attributes?: Record<string, string> | undefined;
}): number | null {
    const sentTimestamp = message.Attributes?.SentTimestamp;

    if (!sentTimestamp) {
        return null;
    }

    const parsed = Number.parseInt(sentTimestamp, 10);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Date.now() - parsed);
}

function getReceiveCount(message: {
    Attributes?: Record<string, string> | undefined;
}): number {
    const receiveCount = message.Attributes?.ApproximateReceiveCount;

    if (!receiveCount) {
        return 1;
    }

    const parsed = Number.parseInt(receiveCount, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    return parsed;
}

export async function startWorkerConsumer(): Promise<void> {
    console.log(`[worker] queue consumer started for ${env.SQS_MAIN_QUEUE_URL}`);

    while (true) {
        const response = await observeWorkerStage(
            'queue.consume',
            {
                queueName: env.SQS_MAIN_QUEUE_URL,
            },
            async () =>
                sqs.send(
                    new ReceiveMessageCommand({
                        QueueUrl: env.SQS_MAIN_QUEUE_URL,
                        MaxNumberOfMessages: 1,
                        WaitTimeSeconds: WORKER_POLL_WAIT_SECONDS,
                        VisibilityTimeout: WORKER_VISIBILITY_TIMEOUT_SECONDS,
                        AttributeNames: ['All'],
                        MessageAttributeNames: ['All'],
                    }),
                ),
        );

        const message = response.Messages?.[0];

        if (!message?.Body) {
            continue;
        }

        const queueMessage = readWorkerQueueMessage(message.Body);
        const receiveCount = getReceiveCount(message);
        const queueLagMs = computeQueueLagMs(message);

        recordQueueConsume({
            queueName: env.SQS_MAIN_QUEUE_URL,
            providerSlug: queueMessage.providerSlug,
            queueLagMs,
            receiveCount,
            eventId: queueMessage.eventId,
            tenantId: queueMessage.tenantId,
            endpointId: queueMessage.endpointId,
        });

        let claim:
            | Awaited<ReturnType<typeof claimEventForProcessing>>
            | null = null;

        const processStartedAt = performance.now();

        try {
            claim = await claimEventForProcessing({
                eventId: queueMessage.eventId,
                isReplay: queueMessage.isReplay === true,
            });

            if (!claim.claimed) {
                logWithContext('info', 'worker skipped message', {
                    eventId: queueMessage.eventId,
                    providerSlug: queueMessage.providerSlug,
                    reason: claim.reason,
                    receiveCount,
                });

                if (message.ReceiptHandle) {
                    await deleteQueueMessage(message.ReceiptHandle);

                    recordQueueAck({
                        queueName: env.SQS_MAIN_QUEUE_URL,
                        outcome: 'skipped',
                        eventId: queueMessage.eventId,
                        providerSlug: queueMessage.providerSlug,
                        tenantId: queueMessage.tenantId,
                        endpointId: queueMessage.endpointId,
                        receiveCount,
                    });
                }

                continue;
            }

            logWithContext('info', 'worker claimed event', {
                eventId: queueMessage.eventId,
                providerSlug: queueMessage.providerSlug,
                attemptNumber: claim.attemptNumber,
                receiveCount,
            });

            await processClaimedEvent({
                eventId: queueMessage.eventId,
                attemptNumber: claim.attemptNumber,
                queueMessage,
            });

            if (message.ReceiptHandle) {
                await deleteQueueMessage(message.ReceiptHandle);

                recordQueueAck({
                    queueName: env.SQS_MAIN_QUEUE_URL,
                    outcome: 'deleted',
                    eventId: queueMessage.eventId,
                    providerSlug: queueMessage.providerSlug,
                    tenantId: queueMessage.tenantId,
                    endpointId: queueMessage.endpointId,
                    receiveCount,
                });
            }
        } catch (error) {
            const classification = classifyWorkerFailure(error);

            logWithContext('error', 'worker processing error', {
                eventId: queueMessage.eventId,
                providerSlug: queueMessage.providerSlug,
                receiveCount,
                errorCategory: classification.category,
                reason:
                    error instanceof Error ? error.message : 'Unknown worker error',
            });

            if (!claim || !claim.claimed) {
                recordQueueAck({
                    queueName: env.SQS_MAIN_QUEUE_URL,
                    outcome: 'failed',
                    eventId: queueMessage.eventId,
                    providerSlug: queueMessage.providerSlug,
                    tenantId: queueMessage.tenantId,
                    endpointId: queueMessage.endpointId,
                    receiveCount,
                });

                continue;
            }

            try {
                let outcome:
                    | 'retryable_failure'
                    | 'non_retryable_failure'
                    | 'poison_failure';

                if (classification.category === 'retryable') {
                    await handleRetryableFailure({
                        eventId: queueMessage.eventId,
                        attemptNumber: claim.attemptNumber,
                        queueMessage,
                        error,
                    });
                    outcome = 'retryable_failure';
                } else if (classification.category === 'non_retryable') {
                    await handleNonRetryableFailure({
                        eventId: queueMessage.eventId,
                        attemptNumber: claim.attemptNumber,
                        queueMessage,
                        error,
                    });
                    outcome = 'non_retryable_failure';
                } else {
                    await handlePoisonFailure({
                        eventId: queueMessage.eventId,
                        attemptNumber: claim.attemptNumber,
                        queueMessage,
                        error,
                    });
                    outcome = 'poison_failure';
                }

                const durationMs = Math.max(
                    0,
                    Math.round(performance.now() - processStartedAt),
                );

                recordWorkerProcessingOutcome({
                    outcome,
                    durationMs,
                    eventId: queueMessage.eventId,
                    attemptNumber: claim.attemptNumber,
                    providerSlug: queueMessage.providerSlug,
                    tenantId: queueMessage.tenantId,
                    endpointId: queueMessage.endpointId,
                    errorCategory: classification.category,
                });

                if (message.ReceiptHandle) {
                    await deleteQueueMessage(message.ReceiptHandle);

                    recordQueueAck({
                        queueName: env.SQS_MAIN_QUEUE_URL,
                        outcome: 'deleted_after_failure',
                        eventId: queueMessage.eventId,
                        providerSlug: queueMessage.providerSlug,
                        tenantId: queueMessage.tenantId,
                        endpointId: queueMessage.endpointId,
                        receiveCount,
                    });
                }
            } catch (handlerError) {
                logWithContext('error', 'worker failure handler itself failed', {
                    eventId: queueMessage.eventId,
                    providerSlug: queueMessage.providerSlug,
                    receiveCount,
                    reason:
                        handlerError instanceof Error
                            ? handlerError.message
                            : 'Unknown handler error',
                });

                const durationMs = Math.max(
                    0,
                    Math.round(performance.now() - processStartedAt),
                );

                recordWorkerProcessingOutcome({
                    outcome: 'handler_failure',
                    durationMs,
                    eventId: queueMessage.eventId,
                    attemptNumber: claim.attemptNumber,
                    providerSlug: queueMessage.providerSlug,
                    tenantId: queueMessage.tenantId,
                    endpointId: queueMessage.endpointId,
                    errorCategory: classification.category,
                });

                recordQueueAck({
                    queueName: env.SQS_MAIN_QUEUE_URL,
                    outcome: 'handler_failure',
                    eventId: queueMessage.eventId,
                    providerSlug: queueMessage.providerSlug,
                    tenantId: queueMessage.tenantId,
                    endpointId: queueMessage.endpointId,
                    receiveCount,
                });
            }
        }
    }
}