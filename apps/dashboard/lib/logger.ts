import { createServiceLogger } from '../../../packages/shared/src/logging';

export const dashboardLogger = createServiceLogger({
    serviceName: 'dashboard',
    environment: process.env.NODE_ENV ?? 'development',
    level: process.env.LOG_LEVEL ?? 'info',
});