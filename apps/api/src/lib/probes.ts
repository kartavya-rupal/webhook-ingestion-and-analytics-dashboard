import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { ListQueuesCommand } from '@aws-sdk/client-sqs';
import { db, redis, s3, sqs } from './clients';

type ProbeItem = {
    name: string;
    ok: boolean;
    detail?: string;
};

export async function probeApiDependencies(): Promise<ProbeItem[]> {
    const results = await Promise.allSettled([
        db.$queryRawUnsafe('SELECT 1'),
        redis.ping(),
        s3.send(new ListBucketsCommand({})),
        sqs.send(new ListQueuesCommand({ MaxResults: 1 })),
    ]);

    const names = ['postgres', 'redis', 's3', 'sqs'];

    return results.map((result, index) => ({
        name: names[index] ?? `dependency-${index + 1}`,
        ok: result.status === 'fulfilled',
        detail:
            result.status === 'rejected'
                ? result.reason instanceof Error
                    ? result.reason.message
                    : 'Unknown error'
                : 'ok',
    }));
}