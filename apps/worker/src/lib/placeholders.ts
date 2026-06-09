import { env } from '../config/env';

type DependencyStatus = 'configured' | 'missing';

type WorkerDependencySnapshot = {
    postgres: { label: string; status: DependencyStatus };
    redis: { label: string; status: DependencyStatus };
    localstack: { label: string; status: DependencyStatus };
    sqs: { label: string; status: DependencyStatus };
};

const isConfigured = (value: string | undefined): DependencyStatus =>
    value && value.trim().length > 0 ? 'configured' : 'missing';

export function getWorkerDependencySnapshot(): WorkerDependencySnapshot {
    return {
        postgres: { label: 'PostgreSQL', status: isConfigured(env.DATABASE_URL) },
        redis: { label: 'Redis', status: isConfigured(env.REDIS_URL) },
        localstack: { label: 'LocalStack', status: isConfigured(env.LOCALSTACK_ENDPOINT) },
        sqs: {
            label: 'SQS queues',
            status:
                isConfigured(env.SQS_MAIN_QUEUE_URL) === 'configured' &&
                    isConfigured(env.SQS_DLQ_URL) === 'configured'
                    ? 'configured'
                    : 'missing',
        },
    };
}