const REDACTED = '[REDACTED]';

function redactObject(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(redactObject);
    }

    if (value && typeof value === 'object') {
        const output: Record<string, unknown> = {};

        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            const normalizedKey = key.toLowerCase();

            if (
                normalizedKey.includes('secret') ||
                normalizedKey.includes('token') ||
                normalizedKey.includes('password') ||
                normalizedKey.includes('authorization') ||
                normalizedKey.includes('apikey') ||
                normalizedKey.includes('api_key') ||
                normalizedKey.includes('signature') ||
                normalizedKey.includes('privatekey') ||
                normalizedKey.includes('private_key')
            ) {
                output[key] = REDACTED;
                continue;
            }

            output[key] = redactObject(child);
        }

        return output;
    }

    return value;
}

export function redactSensitiveText(text: string): string {
    try {
        const parsed = JSON.parse(text);
        return JSON.stringify(redactObject(parsed), null, 2);
    } catch {
        return text
            .replace(
                /("?(?:password|secret|token|api[_-]?key|authorization|signature|private[_-]?key)"?\s*:\s*)"[^"]*"/gi,
                `$1"${REDACTED}"`,
            )
            .replace(
                /((?:password|secret|token|api[_-]?key|authorization|signature|private[_-]?key)\s*=\s*)\S+/gi,
                `$1${REDACTED}`,
            );
    }
}

export { redactSensitiveHeaders, redactSensitiveObject } from '@finrelay/shared';