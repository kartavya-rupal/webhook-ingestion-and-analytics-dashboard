import pino, { type Logger } from 'pino';

export function createServiceLogger(input: {
    serviceName: string;
    environment: string;
    level?: string;
}): Logger {
    return pino({
        level: input.level ?? 'info',
        base: {
            serviceName: input.serviceName,
            environment: input.environment,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
            paths: [
                'password',
                'token',
                'secret',
                'authorization',
                'apiKey',
                'api_key',
                'clientSecret',
                'client_secret',
                'privateKey',
                'private_key',
                'refreshToken',
                'accessToken',
                'signingSecretReference',
                'webhookSigningSecret',
                'secretReference',
                'payload',
                'rawPayload',
                'rawBody',
                'body',
                'requestBody',
                'responseBody',
                'messageBody',
                'headers.authorization',
                'headers.cookie',
                'headers.set-cookie',
                'requestHeaders.authorization',
                'requestHeaders.cookie',
                'requestHeaders.set-cookie',
                'cookie',
                'cookies',
                'session',
            ],
            remove: true,
        },
        serializers: {
            err: pino.stdSerializers.err,
        },
    });
}