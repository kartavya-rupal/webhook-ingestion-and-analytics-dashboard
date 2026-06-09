import { consumeFixedWindowRateLimit, type FixedWindowRateLimitResult } from '../../../packages/shared/src/rate-limit';
import { getDashboardRedisClient } from './redis';

export async function assertDashboardRateLimit(input: {
    key: string;
    limit: number;
    windowSeconds: number;
}): Promise<FixedWindowRateLimitResult> {
    const redis = await getDashboardRedisClient();

    return consumeFixedWindowRateLimit({
        store: redis,
        key: input.key,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
    });
}