import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';

import { healthRouter } from './routes/health';
import { createWebhooksRouter } from './routes/webhooks';
import { readModelRouter } from './routes/read-model';
// import { analyticsRouter } from './routes/analytics';
// import { searchRouter } from './routes/search';
// import { metricsRouter } from './routes/metrics';
import { logger } from './lib/telemetry';
import { attachActor } from './lib/actor-middleware';

export function createServer() {
    const app = express();

    app.use(cors());
    app.use(pinoHttp({ logger }));

    app.get('/', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'api',
            message: 'FinRelay API shell is running.',
        });
    });

    // app.use(metricsRouter);
    app.use('/webhooks', createWebhooksRouter());

    app.use(express.json({ limit: '1mb' }));

    app.use(attachActor);

    app.use('/api', readModelRouter);
    // app.use('/api/analytics', analyticsRouter);
    // app.use('/api/search', searchRouter);

    app.use(healthRouter);

    return app;
}