import { createServer as createHttpServer, type Server } from 'node:http';
import { env } from './config/env';
import { probeWorkerDependencies } from './lib/probes';
import { startHeartbeat } from './lib/heartbeat';
import { startWorkerConsumer } from './lib/consumer';
// import { getMetricsRegistry, logger } from './lib/telemetry';
import { startReplayDispatcher } from './lib/replay-dispatcher';
// import { startObservability, stopObservability } from './lib/observability';

async function startMetricsServer(): Promise<Server> {
    // const registry = getMetricsRegistry();
    // const metricsPort = Number(process.env.WORKER_METRICS_PORT ?? '4010');

    const server = createHttpServer(async (req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    status: 'ok',
                    service: 'worker',
                    appName: env.APP_NAME,
                    nodeEnv: env.NODE_ENV,
                }),
            );
            return;
        }

        // if (req.url === '/metrics') {
        //     res.writeHead(200, {
        //         'content-type': registry.contentType,
        //     });
        //     res.end(await registry.metrics());
        //     return;
        // }

        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
    });

    // await new Promise<void>((resolve) => {
        // server.listen(metricsPort, () => {
            // logger.info(
            //     {
            //         metricsPort,
            //     },
            //     '[worker] metrics server listening',
            // );
            // resolve();
        // });
    // });

    return server;
}

async function bootstrap() {
    console.log(`[worker] ${env.APP_NAME} booting in ${env.NODE_ENV}`);

    // await startObservability();

    const dependencies = await probeWorkerDependencies();
    console.table(dependencies);

    const ready = dependencies.every((dependency) => dependency.ok);
    if (!ready) {
        throw new Error('Worker dependency check failed');
    }

    const stopHeartbeat = startHeartbeat();
    const metricsServer = await startMetricsServer();

    let shuttingDown = false;

    const shutdown = () => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;

        console.log('[worker] shutting down');

        stopHeartbeat();

        Promise.resolve()
            .then(
                () =>
                    new Promise<void>((resolve) => {
                        metricsServer.close(() => resolve());
                    }),
            )
            // .then(() => stopObservability())
            .then(() => process.exit(0))
            .catch((error) => {
                console.error('[worker] shutdown error', error);
                process.exit(1);
            });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await Promise.all([
        startWorkerConsumer(),
        startReplayDispatcher(),
    ]);
}

bootstrap().catch((error) => {
    console.error('[worker] failed to boot', error);
    process.exit(1);
});