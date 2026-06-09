import { env } from './config/env';
// import { startObservability } from './observability';
import { createServer } from './server';

// startObservability().catch((error) => {
//     console.error('Failed to start observability:', error);
//     process.exit(1);
// });

const app = createServer();

app.listen(env.API_PORT, () => {
    console.log(`[api] ${env.APP_NAME} listening on http://localhost:${env.API_PORT}`);
    console.log(`[api] environment: ${env.NODE_ENV}`);
});

const shutdown = () => {
    console.log('[api] shutting down');
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);