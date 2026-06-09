const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = [
    'password',
    'pass',
    'token',
    'secret',
    'authorization',
    'cookie',
    'set-cookie',
    'apikey',
    'api_key',
    'clientsecret',
    'client_secret',
    'privatekey',
    'private_key',
    'signature',
    'rawbody',
    'raw_body',
    'payload',
    'requestbody',
    'request_body',
    'responsebody',
    'response_body',
    'body',
    'messagebody',
    'message_body',
];

function isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();

    return SENSITIVE_KEYS.some((candidate) => normalized.includes(candidate));
}

export function redactSensitiveObject<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveObject(item)) as T;
    }

    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const output: Record<string, unknown> = {};

        for (const [key, child] of Object.entries(source)) {
            if (isSensitiveKey(key)) {
                output[key] = REDACTED;
                continue;
            }

            output[key] = redactSensitiveObject(child);
        }

        return output as T;
    }

    return value;
}

export function redactSensitiveText(text: string): string {
    try {
        const parsed = JSON.parse(text);
        return JSON.stringify(redactSensitiveObject(parsed), null, 2);
    } catch {
        return text
            .replace(
                /("?(?:password|secret|token|api[_-]?key|authorization|cookie|signature|private[_-]?key|body|payload)"?\s*:\s*)"[^"]*"/gi,
                `$1"${REDACTED}"`,
            )
            .replace(
                /((?:password|secret|token|api[_-]?key|authorization|cookie|signature|private[_-]?key|body|payload)\s*=\s*)\S+/gi,
                `$1${REDACTED}`,
            );
    }
}

export function redactSensitiveHeaders(
    headers: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!headers) {
        return null;
    }

    return redactSensitiveObject(headers);
}