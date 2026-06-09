import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';

let cachedClient: S3Client | null = null;


export function getS3Client(): S3Client {
    if (!cachedClient) {
        cachedClient = new S3Client({
            region: env.AWS_REGION,
            endpoint: env.LOCALSTACK_ENDPOINT || undefined,
            forcePathStyle: Boolean(env.LOCALSTACK_ENDPOINT),
            credentials:
                env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
                    ? {
                        accessKeyId: env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                    }
                    : undefined,
        });
    }

    return cachedClient;
}

export function parseS3Location(payloadPath: string, fallbackBucket: string) {
    const trimmed = payloadPath.trim();

    if (trimmed.startsWith('s3://')) {
        const withoutScheme = trimmed.slice('s3://'.length);
        const [bucket, ...rest] = withoutScheme.split('/');

        return {
            bucket: bucket || fallbackBucket,
            key: rest.join('/'),
        };
    }

    return {
        bucket: fallbackBucket,
        key: trimmed.replace(/^\/+/, ''),
    };
}

async function streamToText(body: unknown): Promise<string> {
    if (!body) {
        return '';
    }

    if (typeof body === 'string') {
        return body;
    }

    if (Buffer.isBuffer(body)) {
        return body.toString('utf8');
    }

    const asyncIterable = body as AsyncIterable<Buffer | Uint8Array | string>;

    if (typeof asyncIterable[Symbol.asyncIterator] !== 'function') {
        return '';
    }

    const chunks: Buffer[] = [];

    for await (const chunk of asyncIterable) {
        if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk, 'utf8'));
        } else {
            chunks.push(Buffer.from(chunk));
        }
    }

    return Buffer.concat(chunks).toString('utf8');
}

export async function readArchivedPayloadText(payloadPath: string): Promise<{
    text: string;
    bucket: string;
    key: string;
}> {
    const { bucket, key } = parseS3Location(payloadPath, env.S3_BUCKET_NAME);
    const s3 = getS3Client();

    const response = await s3.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );

    const text = await streamToText(response.Body);

    return { text, bucket, key };
}