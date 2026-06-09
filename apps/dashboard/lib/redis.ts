import { createClient, type RedisClientType } from 'redis';

const REDIS_URL =
    process.env.REDIS_URL ?? 'redis://localhost:6379';

let clientPromise: Promise<RedisClientType> | null = null;

export async function getDashboardRedisClient(): Promise<RedisClientType> {
    if (!clientPromise) {
        const client = createClient({ url: REDIS_URL });

        client.on('error', (error) => {
            console.error('[dashboard][redis] client error', error);
        });

        clientPromise = client.connect().then(() => client);
    }

    return clientPromise;
}