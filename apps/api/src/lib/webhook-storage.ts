import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

export function hashWebhookPayload(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
}

export function buildWebhookObjectKey(input: {
    tenantId: string;
    providerSlug: string;
    eventId: string;
    receivedAt?: Date;
}): string {
    const receivedAt = input.receivedAt ?? new Date();

    const year = receivedAt.getUTCFullYear();
    const month = String(receivedAt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(receivedAt.getUTCDate()).padStart(2, '0');

    return `raw/${input.tenantId}/${input.providerSlug}/${year}/${month}/${day}/${input.eventId}.json`;
}

export async function archiveWebhookPayload(input: {
    s3: S3Client;
    bucketName: string;
    tenantId: string;
    providerSlug: string;
    eventId: string;
    rawBody: Buffer;
    contentType?: string;
}): Promise<{
    objectKey: string;
    payloadPath: string;
}> {
    const objectKey = buildWebhookObjectKey({
        tenantId: input.tenantId,
        providerSlug: input.providerSlug,
        eventId: input.eventId,
    });

    await input.s3.send(
        new PutObjectCommand({
            Bucket: input.bucketName,
            Key: objectKey,
            Body: input.rawBody,
            ContentType: input.contentType ?? 'application/json',
        }),
    );

    return {
        objectKey,
        payloadPath: `s3://${input.bucketName}/${objectKey}`,
    };
}