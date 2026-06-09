'use client';

import Link from 'next/link';
import type { AnalyticsOverview, AnalyticsQueryParams } from '@/lib/analytics';
import {
    formatCount,
    formatDurationMs,
    formatPercentage,
    formatStatusLabel,
} from '@/lib/format';

function buildQueryString(
    filters: AnalyticsQueryParams,
    overrides: Partial<AnalyticsQueryParams> = {},
): string {
    const params = new URLSearchParams();
    const merged = { ...filters, ...overrides };

    for (const [key, value] of Object.entries(merged)) {
        if (typeof value === 'string' && value.trim()) {
            params.set(key, value.trim());
        }
    }

    return params.toString();
}

function buildHref(
    path: string,
    filters: AnalyticsQueryParams,
    overrides: Partial<AnalyticsQueryParams> = {},
): string {
    const query = buildQueryString(filters, overrides);
    return query ? `${path}?${query}` : path;
}

function trendDirection(delta: number | null): string {
    if (delta === null) {
        return 'No comparison yet';
    }

    if (delta > 0) {
        return 'Up';
    }

    if (delta < 0) {
        return 'Down';
    }

    return 'Flat';
}

function pressureLabel(summary: AnalyticsOverview['summary']): string {
    if (summary.dlqRate >= 0.05 || summary.failureRate >= 0.25) {
        return 'High pressure';
    }

    if (summary.retryRate >= 0.1 || summary.failureRate >= 0.12) {
        return 'Watch closely';
    }

    return 'Stable';
}

export function AnalyticsOperationalSummary({
    overview,
    filters,
}: {
    overview: AnalyticsOverview;
    filters: AnalyticsQueryParams;
}) {
    const latestTrend = overview.trends[overview.trends.length - 1] ?? null;
    const previousTrend = overview.trends[overview.trends.length - 2] ?? null;

    const volumeDelta =
        latestTrend && previousTrend
            ? latestTrend.totalEvents - previousTrend.totalEvents
            : null;

    const topEndpoint = overview.endpoints[0] ?? null;
    const topEventType = overview.eventTypes[0] ?? null;

    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                    Operational readout
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                    What needs attention right now
                </h2>
                <p className="text-sm text-zinc-400">
                    These cards are meant to surface the signal that matters first.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Pressure level
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        {pressureLabel(overview.summary)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        Failure rate {formatPercentage(overview.summary.failureRate)} · DLQ rate{' '}
                        {formatPercentage(overview.summary.dlqRate)}
                    </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Recent volume change
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                        {volumeDelta === null
                            ? '—'
                            : `${volumeDelta > 0 ? '+' : ''}${formatCount(Math.abs(volumeDelta))}`}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        {trendDirection(volumeDelta)} vs previous bucket
                    </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Worst endpoint
                    </p>
                    <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                        {topEndpoint?.endpointName ?? '—'}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        Failure rate {topEndpoint ? formatPercentage(topEndpoint.failureRate) : '—'}
                    </p>
                    {topEndpoint ? (
                        <Link
                            href={buildHref('/events', filters, {
                                endpointId: topEndpoint.endpointId,
                            })}
                            className="mt-3 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                        >
                            Open endpoint events
                        </Link>
                    ) : null}
                </div>

                <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Worst event type
                    </p>
                    <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                        {topEventType?.eventType ?? '—'}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                        Failure rate {topEventType ? formatPercentage(topEventType.failureRate) : '—'}
                    </p>
                    {topEventType ? (
                        <Link
                            href={buildHref('/events', filters, {
                                eventType: topEventType.eventType,
                            })}
                            className="mt-3 inline-block text-sm font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                        >
                            Open event type events
                        </Link>
                    ) : null}
                </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                <Link
                    href={buildHref('/events', filters)}
                    className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Open matching events
                </Link>
                <Link
                    href={buildHref('/dlq', filters)}
                    className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Open matching DLQ
                </Link>
                <Link
                    href="/replay-jobs"
                    className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    View replay jobs
                </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Replay success
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                        {formatPercentage(overview.summary.replaySuccessRate)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        {formatCount(overview.summary.replaySucceeded)} succeeded of{' '}
                        {formatCount(overview.summary.replayRequests)} replay requests
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Avg latency
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                        {formatDurationMs(overview.summary.avgLatencyMs)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        Mean delivery time in the selected range
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Filter scope
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                        {filters.range ?? '7d'} · {filters.tenantId ?? 'all tenants'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        {filters.endpointId || filters.eventType || filters.status
                            ? 'Narrowed operational view'
                            : 'Broad operational view'}
                    </p>
                </div>
            </div>
        </section>
    );
}