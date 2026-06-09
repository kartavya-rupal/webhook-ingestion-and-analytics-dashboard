import { Router } from 'express';
import { env } from '../config/env';
import { probeApiDependencies } from '../lib/probes';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'api',
        app: env.APP_NAME,
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
    });
});

healthRouter.get('/ready', async (_req, res) => {
    const dependencies = await probeApiDependencies();
    const ready = dependencies.every((dependency) => dependency.ok);

    res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'not_ready',
        service: 'api',
        dependencies,
        note: 'Phase 3 local readiness check.',
    });
});