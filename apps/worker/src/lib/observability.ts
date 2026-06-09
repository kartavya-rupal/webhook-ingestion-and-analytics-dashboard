import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { env } from '../config/env';

const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()
    ? new OTLPTraceExporter({
        url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    })
    : new ConsoleSpanExporter();

const sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
});

let started = false;

export async function startObservability(): Promise<void> {
    if (started) return;
    await sdk.start();
    started = true;
}

export async function stopObservability(): Promise<void> {
    if (!started) return;
    await sdk.shutdown();
    started = false;
}