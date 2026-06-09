import { performance } from 'node:perf_hooks';
import { db } from './clients';
import {
    observeWorkerStage,
    recordWorkerProcessingOutcome,
    logWithContext,
} from './telemetry';
import { markDeliveryAttemptSucceeded } from './delivery-completion';
import type { WorkerQueueMessage } from '@finrelay/shared';

import {
    NonRetryableProcessingError,
    PoisonProcessingError,
    RetryableProcessingError,
} from '@finrelay/shared';

async function runPlaceholderBusinessLogic(input: {
    eventId: string;
    attemptNumber: number;
    expectedStatus: 'processing' | 'replay_processing';
    isReplay: boolean;
}): Promise<void> {
    const event = await db.webhookEvent.findUnique({
        where: { id: input.eventId },
    });

    if (!event) {
        throw new Error(`Event not found: ${input.eventId}`);
    }

    if (event.status !== input.expectedStatus) {
        throw new Error(`Event ${input.eventId} is not in ${input.expectedStatus} state`);
    }

    // Keep the demo fixtures failing on normal ingest,
    // but let replay run all the way through so you can test recovery.
    if (!input.isReplay && event.eventType === 'test.retryable') {
        throw new RetryableProcessingError('Simulated retryable failure');
    }

    if (!input.isReplay && event.eventType === 'test.nonretryable') {
        throw new NonRetryableProcessingError('Simulated non-retryable failure');
    }

    if (!input.isReplay && event.eventType === 'test.poison') {
        throw new PoisonProcessingError('Simulated poison failure');
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    logWithContext('info', 'worker placeholder processing complete', {
        eventId: input.eventId,
        attemptNumber: input.attemptNumber,
        tenantId: event.tenantId,
        endpointId: event.endpointId,
        providerSlug: event.providerSlug,
        isReplay: input.isReplay,
    });
}

export async function processClaimedEvent(input: {
    eventId: string;
    attemptNumber: number;
    queueMessage: WorkerQueueMessage;
}): Promise<{ durationMs: number }> {
    const startedAt = performance.now();
    const isReplay = input.queueMessage.isReplay === true;
    const expectedStatus = isReplay ? 'replay_processing' : 'processing';

    return observeWorkerStage(
        'worker.process',
        {
            eventId: input.eventId,
            attemptNumber: input.attemptNumber,
        },
        async () => {
            await runPlaceholderBusinessLogic({
                eventId: input.eventId,
                attemptNumber: input.attemptNumber,
                expectedStatus,
                isReplay,
            });

            const durationMs = Math.max(
                0,
                Math.round(performance.now() - startedAt),
            );

            await markDeliveryAttemptSucceeded({
                eventId: input.eventId,
                attemptNumber: input.attemptNumber,
                durationMs,
                isReplay,
                replayJobId: input.queueMessage.replayJobId ?? null,
            });

            recordWorkerProcessingOutcome({
                outcome: 'success',
                durationMs,
                eventId: input.eventId,
                attemptNumber: input.attemptNumber,
            });

            return { durationMs };
        },
    );
}