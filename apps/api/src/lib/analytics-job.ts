import { performance } from 'node:perf_hooks';
import { db } from './clients';
import {
    observeAnalyticsJob,
    recordAnalyticsJobOutcome,
    logWithContext,
} from './telemetry';

export async function runAnalyticsAggregationJob(input: {
    jobName: string;
    tenantId?: string | null;
    windowMinutes: number;
    requestId?: string | null;
}): Promise<{
    jobName: string;
    tenantId: string | null;
    windowMinutes: number;
    totalEvents: number;
    succeededEvents: number;
    retryableFailures: number;
    dlqEvents: number;
}> {
    const startedAt = performance.now();
    const windowStart = new Date(Date.now() - input.windowMinutes * 60_000);

    try {
        const result = await observeAnalyticsJob(
            {
                jobName: input.jobName,
                tenantId: input.tenantId ?? null,
                requestId: input.requestId ?? null,
            },
            async () => {
                const whereTenant = input.tenantId
                    ? { tenantId: input.tenantId }
                    : {};

                const [totalEvents, succeededEvents, retryableFailures, dlqEvents] =
                    await Promise.all([
                        db.webhookEvent.count({
                            where: {
                                ...whereTenant,
                                receivedAt: {
                                    gte: windowStart,
                                },
                            },
                        }),
                        db.webhookEvent.count({
                            where: {
                                ...whereTenant,
                                status: 'succeeded',
                                receivedAt: {
                                    gte: windowStart,
                                },
                            },
                        }),
                        db.webhookEvent.count({
                            where: {
                                ...whereTenant,
                                status: 'failed_retryable',
                                receivedAt: {
                                    gte: windowStart,
                                },
                            },
                        }),
                        db.webhookEvent.count({
                            where: {
                                ...whereTenant,
                                status: 'moved_to_dlq',
                                receivedAt: {
                                    gte: windowStart,
                                },
                            },
                        }),
                    ]);

                return {
                    jobName: input.jobName,
                    tenantId: input.tenantId ?? null,
                    windowMinutes: input.windowMinutes,
                    totalEvents,
                    succeededEvents,
                    retryableFailures,
                    dlqEvents,
                };
            },
        );

        recordAnalyticsJobOutcome({
            jobName: input.jobName,
            outcome: 'success',
            durationMs: performance.now() - startedAt,
            tenantId: input.tenantId ?? null,
            requestId: input.requestId ?? null,
            processedCount: result.totalEvents,
        });

        logWithContext('info', 'analytics job completed', {
            jobName: input.jobName,
            tenantId: input.tenantId ?? null,
            windowMinutes: input.windowMinutes,
            totalEvents: result.totalEvents,
            succeededEvents: result.succeededEvents,
            retryableFailures: result.retryableFailures,
            dlqEvents: result.dlqEvents,
        });

        return result;
    } catch (error) {
        recordAnalyticsJobOutcome({
            jobName: input.jobName,
            outcome: 'error',
            durationMs: performance.now() - startedAt,
            tenantId: input.tenantId ?? null,
            requestId: input.requestId ?? null,
            errorCategory:
                error instanceof Error ? error.message : 'Unknown analytics error',
        });

        throw error;
    }
}