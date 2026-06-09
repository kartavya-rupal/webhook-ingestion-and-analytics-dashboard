import type Redis from 'ioredis';

export async function reserveWebhookDedupeKey(input: {
    redis: Redis;
    dedupeKey: string;
    value: string;
    ttlSeconds: number;
}): Promise<boolean> {
    const result = await input.redis.set(
        input.dedupeKey,
        input.value,
        'EX',
        input.ttlSeconds,
        'NX',
    );

    return result === 'OK';
}

export async function releaseWebhookDedupeKey(input: {
    redis: Redis;
    dedupeKey: string;
}): Promise<void> {
    await input.redis.del(input.dedupeKey);
}