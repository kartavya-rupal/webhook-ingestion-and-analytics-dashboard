import crypto from 'node:crypto';
import type Redis from 'ioredis';

function hashValue(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function buildReplayKey(input: {
    providerSlug: string;
    timestampSeconds: number;
    signatureHeader: string;
}): string {
    const fingerprint = hashValue(
        `${input.providerSlug}:${input.timestampSeconds}:${input.signatureHeader}`,
    );

    return `finrelay:webhook:replay:${fingerprint}`;
}

export async function reserveWebhookReplaySignature(input: {
    redis: Redis;
    providerSlug: string;
    timestampSeconds: number;
    signatureHeader: string;
    ttlSeconds: number;
}): Promise<boolean> {
    const key = buildReplayKey({
        providerSlug: input.providerSlug,
        timestampSeconds: input.timestampSeconds,
        signatureHeader: input.signatureHeader,
    });

    const result = await input.redis.set(
        key,
        '1',
        'EX',
        input.ttlSeconds,
        'NX',
    );

    return result === 'OK';
}