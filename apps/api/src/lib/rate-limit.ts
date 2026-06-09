import { consumeFixedWindowRateLimit, type FixedWindowRateLimitResult } from '@finrelay/shared';
import { redis } from './clients';

export async function assertApiRateLimit(input: {
    key: string;
    limit: number;
    windowSeconds: number;
}): Promise<FixedWindowRateLimitResult> {
    return consumeFixedWindowRateLimit({
        store: redis,
        key: input.key,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
    });
}