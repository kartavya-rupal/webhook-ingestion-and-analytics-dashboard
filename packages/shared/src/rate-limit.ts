type RateLimitStore = {
    incr(key: string): Promise<number> | number;
    expire(key: string, seconds: number): Promise<number> | number;
    ttl(key: string): Promise<number> | number;
};

export type FixedWindowRateLimitResult = {
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    resetInSeconds: number;
};

export async function consumeFixedWindowRateLimit(input: {
    store: RateLimitStore;
    key: string;
    limit: number;
    windowSeconds: number;
}): Promise<FixedWindowRateLimitResult> {
    const current = await input.store.incr(input.key);

    if (current === 1) {
        await input.store.expire(input.key, input.windowSeconds);
    }

    const ttl = await input.store.ttl(input.key);
    const resetInSeconds = ttl >= 0 ? ttl : input.windowSeconds;
    const remaining = Math.max(input.limit - current, 0);

    return {
        allowed: current <= input.limit,
        current,
        limit: input.limit,
        remaining,
        resetInSeconds,
    };
}