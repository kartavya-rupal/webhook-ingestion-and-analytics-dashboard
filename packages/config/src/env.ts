import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../../../.env.local') });

export const backendEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().default('FinRelay'),
    APP_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
    APP_URL: z.string().default('http://localhost:3000'),
    API_URL: z.string().default('http://localhost:4000'),
    API_PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

    AWS_REGION: z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: z.string().optional().default(''),
    AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
    LOCALSTACK_ENDPOINT: z.string().optional().default(''),

    S3_BUCKET_NAME: z.string().default('finrelay-dev-raw-events'),
    S3_REGION: z.string().default('ap-south-1'),
    SQS_MAIN_QUEUE_URL: z.string().optional().default(''),
    SQS_DLQ_URL: z.string().optional().default(''),

    ECR_REGISTRY_URL: z.string().optional().default(''),
    ECS_CLUSTER_NAME: z.string().optional().default(''),
    ECS_SERVICE_API: z.string().optional().default(''),
    ECS_SERVICE_WORKER: z.string().optional().default(''),
    ECS_SERVICE_DASHBOARD: z.string().optional().default(''),

    JWT_SECRET: z.string().default('replace_me_with_a_long_random_secret'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    AUTH_PROVIDER: z.string().default('jwt'),
    CLERK_SECRET_KEY: z.string().optional().default(''),
    CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
    AUTH_SECRET: z.string().optional().default(''),

    OTEL_SERVICE_NAME: z.string().default('finrelay-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional().default(''),
    OTEL_TRACES_EXPORTER: z.string().default('otlp'),
    OTEL_METRICS_EXPORTER: z.string().default('prometheus'),
    OTEL_LOGS_EXPORTER: z.string().default('console'),
    
    WORKER_METRICS_PORT: z.coerce.number().int().positive().default(4010),

    PROMETHEUS_ENDPOINT: z.string().default('http://localhost:9090'),
    GRAFANA_URL: z.string().default('http://localhost:3001'),
    LOKI_URL: z.string().default('http://localhost:3100'),

    CLICKHOUSE_HOST: z.string().optional().default(''),
    CLICKHOUSE_PORT: z.coerce.number().int().positive().default(8123),
    CLICKHOUSE_DB: z.string().default('finrelay_analytics'),
    CLICKHOUSE_USER: z.string().default('default'),
    CLICKHOUSE_PASSWORD: z.string().optional().default(''),

    OPENSEARCH_URL: z.string().optional().default(''),
    OPENSEARCH_USERNAME: z.string().optional().default(''),
    OPENSEARCH_PASSWORD: z.string().optional().default(''),

    SLACK_WEBHOOK_URL: z.string().optional().default(''),
    ALERT_EMAIL_FROM: z.string().optional().default(''),
    ALERT_EMAIL_TO: z.string().optional().default(''),

    WEBHOOK_SIGNATURE_HEADER: z.string().default('x-webhook-signature'),
    WEBHOOK_TIMESTAMP_HEADER: z.string().default('x-webhook-timestamp'),
    WEBHOOK_ID_HEADER: z.string().default('x-webhook-id'),
    WEBHOOK_SIGNING_SECRET: z.string().min(1, 'WEBHOOK_SIGNING_SECRET is required'),

    MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(5),
    RETRY_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(1000),
    RETRY_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(30000),
    DEDUP_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

    LOG_LEVEL: z.string().default('info'),
    ENABLE_PAYLOAD_REDACTION: z.coerce.boolean().default(true),
    ENABLE_REPLAY: z.coerce.boolean().default(true),
});

export function loadBackendEnv(rawEnv: NodeJS.ProcessEnv = process.env) {
    return backendEnvSchema.parse(rawEnv);
}

export const backendEnv = loadBackendEnv();