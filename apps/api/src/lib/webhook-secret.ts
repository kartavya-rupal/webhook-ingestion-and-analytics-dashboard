import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { env } from '../config/env';

type WebhookSecretInput = {
    signingSecretReference: string | null;
    providerSlug: string;
    tenantId: string;
    endpointId: string;
};

const client = new SecretsManagerClient({
    region: env.AWS_REGION,
});

const cache = new Map<string, string>();

export async function resolveWebhookSigningSecret(
    input: WebhookSecretInput,
): Promise<string> {
    const reference = input.signingSecretReference?.trim();

    if (reference) {
        const cached = cache.get(reference);
        if (cached) {
            return cached;
        }

        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: reference,
            }),
        );

        const secret = response.SecretString?.trim() ?? '';

        if (!secret) {
            throw new Error(
                `Missing signing secret for provider ${input.providerSlug}`,
            );
        }

        cache.set(reference, secret);
        return secret;
    }

    const fallback = env.WEBHOOK_SIGNING_SECRET.trim();

    if (!fallback) {
        throw new Error(
            `Missing WEBHOOK_SIGNING_SECRET for provider ${input.providerSlug}`,
        );
    }

    return fallback;
}