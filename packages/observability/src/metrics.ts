import * as client from 'prom-client';

export const observabilityRegistry = new client.Registry();

client.collectDefaultMetrics({
    register: observabilityRegistry,
    prefix: 'finrelay_',
});

export function registerDefaultLabels(labels: Record<string, string>): void {
    observabilityRegistry.setDefaultLabels(labels);
}

export function createCounter<LabelNames extends string = string>(
    config: client.CounterConfiguration<LabelNames>,
): client.Counter<LabelNames> {
    return new client.Counter({
        ...config,
        registers: [observabilityRegistry],
    });
}

export function createGauge<LabelNames extends string = string>(
    config: client.GaugeConfiguration<LabelNames>,
): client.Gauge<LabelNames> {
    return new client.Gauge({
        ...config,
        registers: [observabilityRegistry],
    });
}

export function createHistogram<LabelNames extends string = string>(
    config: client.HistogramConfiguration<LabelNames>,
): client.Histogram<LabelNames> {
    return new client.Histogram({
        ...config,
        registers: [observabilityRegistry],
    });
}

export async function renderMetrics(): Promise<string> {
    return observabilityRegistry.metrics();
}

export function getMetricsContentType(): string {
    return observabilityRegistry.contentType;
}

export function getMetricsRegistry(): client.Registry {
    return observabilityRegistry;
}