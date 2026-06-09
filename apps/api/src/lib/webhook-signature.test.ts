import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './webhook-signature';

function sign(secret: string, timestamp: string, rawBody: Buffer) {
    return `sha256=${crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(rawBody)
        .digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
    it('accepts a valid signature', () => {
        const body = Buffer.from(
            JSON.stringify({
                id: 'evt_123',
                type: 'payment.succeeded',
                data: { amount: 2500 },
            }),
        );

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const secret = 'test-secret';
        const signature = sign(secret, timestamp, body);

        const result = verifyWebhookSignature({
            signingSecret: secret,
            timestampHeader: timestamp,
            signatureHeader: signature,
            rawBody: body,
        });

        expect(result.ok).toBe(true);
    });

    it('rejects a bad signature', () => {
        const body = Buffer.from('{"id":"evt_123","type":"payment.succeeded"}');
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const result = verifyWebhookSignature({
            signingSecret: 'test-secret',
            timestampHeader: timestamp,
            signatureHeader: 'sha256=bad',
            rawBody: body,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('signature_mismatch');
        }
    });

    it('rejects a stale timestamp', () => {
        const body = Buffer.from('{"id":"evt_123","type":"payment.succeeded"}');
        const timestamp = String(Math.floor(Date.now() / 1000) - 1000);

        const result = verifyWebhookSignature({
            signingSecret: 'test-secret',
            timestampHeader: timestamp,
            signatureHeader: 'sha256=whatever',
            rawBody: body,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('stale_timestamp');
        }
    });
});