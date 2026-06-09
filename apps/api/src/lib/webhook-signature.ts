import crypto from 'node:crypto';
import { WEBHOOK_ALLOWED_CLOCK_SKEW_SECONDS } from '@finrelay/shared';

export type WebhookSignatureFailureReason =
    | 'missing_signature'
    | 'missing_timestamp'
    | 'invalid_timestamp'
    | 'stale_timestamp'
    | 'invalid_format'
    | 'signature_mismatch';

export type WebhookSignatureVerificationResult =
    | {
        ok: true;
        timestampSeconds: number;
    }
    | {
        ok: false;
        reason: WebhookSignatureFailureReason;
    };

function safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookSignature(input: {
    signingSecret: string;
    timestampHeader?: string | null | undefined;
    signatureHeader?: string | null | undefined;
    rawBody: Buffer;
    allowedClockSkewSeconds?: number;
}): WebhookSignatureVerificationResult {
    const {
        signingSecret,
        timestampHeader,
        signatureHeader,
        rawBody,
        allowedClockSkewSeconds = WEBHOOK_ALLOWED_CLOCK_SKEW_SECONDS,
    } = input;

    if (!signatureHeader || signatureHeader.trim().length === 0) {
        return { ok: false, reason: 'missing_signature' };
    }

    if (!timestampHeader || timestampHeader.trim().length === 0) {
        return { ok: false, reason: 'missing_timestamp' };
    }

    const timestampSeconds = Number(timestampHeader.trim());
    if (!Number.isFinite(timestampSeconds) || !Number.isInteger(timestampSeconds)) {
        return { ok: false, reason: 'invalid_timestamp' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = Math.abs(nowSeconds - timestampSeconds);

    if (ageSeconds > allowedClockSkewSeconds) {
        return { ok: false, reason: 'stale_timestamp' };
    }

    const normalizedSignature = signatureHeader.trim();
    if (!normalizedSignature.startsWith('sha256=')) {
        return { ok: false, reason: 'invalid_format' };
    }

    const receivedSignature = normalizedSignature.slice('sha256='.length);

    console.log('raw length', rawBody.length);

    console.log(
        'raw hex',
        rawBody.toString('hex'),
    );

    const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(`${timestampSeconds}.`)
        .update(rawBody)
        .digest('hex');

    console.log('----- SIGNATURE DEBUG -----');
    console.log('timestampSeconds:', timestampSeconds);
    console.log('secret:', signingSecret);
    console.log('received:', receivedSignature);
    console.log('expected:', expectedSignature);
    console.log('rawBody:', rawBody.toString('utf8'));
    console.log('---------------------------');

    if (!safeEqual(receivedSignature, expectedSignature)) {
        return { ok: false, reason: 'signature_mismatch' };
    }

    return {
        ok: true,
        timestampSeconds,
    };
}

export function mapWebhookSignatureFailureToStatusCode(
    reason: WebhookSignatureFailureReason,
): number {
    switch (reason) {
        case 'missing_signature':
        case 'missing_timestamp':
        case 'invalid_timestamp':
            return 400;
        case 'stale_timestamp':
        case 'invalid_format':
        case 'signature_mismatch':
            return 401;
        default:
            return 400;
    }
}