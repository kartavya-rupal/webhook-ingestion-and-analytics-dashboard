import { Router } from 'express';
import { getMetricsRegistry } from '../lib/telemetry';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req, res) => {
    const registry = getMetricsRegistry();
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
});