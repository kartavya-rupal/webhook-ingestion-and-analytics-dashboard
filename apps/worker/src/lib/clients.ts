import Redis from 'ioredis';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { db } from '@finrelay/db';
import { env } from '../config/env';

const credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || 'test',
};

const hasLocalstack = env.LOCALSTACK_ENDPOINT.trim().length > 0;

export const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
});

export const s3 = new S3Client({
    region: env.AWS_REGION,
    endpoint: hasLocalstack ? env.LOCALSTACK_ENDPOINT : undefined,
    forcePathStyle: hasLocalstack,
    credentials,
});

export const sqs = new SQSClient({
    region: env.AWS_REGION,
    endpoint: hasLocalstack ? env.LOCALSTACK_ENDPOINT : undefined,
    credentials,
});

export { db };