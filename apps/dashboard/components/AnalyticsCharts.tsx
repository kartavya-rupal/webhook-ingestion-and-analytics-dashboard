'use client';

import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatCount, formatDateTime, formatDurationMs } from '@/lib/format';
import type { AnalyticsOverview } from '@/lib/analytics';
import { DashboardEmptyState } from './DashboardEmptyState';

function ChartCard({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                    {title}
                </h2>
                <p className="text-sm text-zinc-400">{description}</p>
            </div>
            {children}
        </section>
    );
}

function formatBucket(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('en-GB', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
    });
}

export function AnalyticsCharts({ overview }: { overview: AnalyticsOverview }) {
    const { trends, endpoints, eventTypes, replays } = overview;

    const hasAnyData =
        trends.length > 0 || endpoints.length > 0 || eventTypes.length > 0 || replays.length > 0;

    if (!hasAnyData) {
        return (
            <DashboardEmptyState
                title="No analytics yet"
                description="Once ClickHouse has aggregate rows, the charts will render here."
            />
        );
    }

    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard
                title="Event trend over time"
                description="Total traffic and successful deliveries over the selected period."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="bucketStartUtc"
                                tickFormatter={formatBucket}
                                minTickGap={24}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(value) => formatDateTime(String(value))}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="totalEvents"
                                name="Total events"
                                stroke="#ffffff"
                                fillOpacity={0.15}
                            />
                            <Area
                                type="monotone"
                                dataKey="succeededEvents"
                                name="Succeeded"
                                stroke="#10b981"
                                fillOpacity={0.2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Success vs failure trend"
                description="How the system behaved across the selected period."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="bucketStartUtc"
                                tickFormatter={formatBucket}
                                minTickGap={24}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(value) => formatDateTime(String(value))}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="succeededEvents" name="Succeeded" stroke="#10b981" />
                            <Line type="monotone" dataKey="retryableFailures" name="Retryable failures" stroke="#38bdf8" />
                            <Line type="monotone" dataKey="nonRetryableFailures" name="Non-retryable failures" stroke="#f59e0b" />
                            <Line type="monotone" dataKey="dlqEvents" name="DLQ events" stroke="#ef4444" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Retry vs DLQ trend"
                description="Whether the system is recovering or pushing more into quarantine."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="bucketStartUtc"
                                tickFormatter={formatBucket}
                                minTickGap={24}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(value) => formatDateTime(String(value))}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="retryableFailures" name="Retryable failures" stroke="#38bdf8" />
                            <Line type="monotone" dataKey="dlqEvents" name="DLQ events" stroke="#ef4444" />
                            <Line type="monotone" dataKey="replayRequests" name="Replay requests" stroke="#a855f7" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Latency trend"
                description="How delivery latency is moving over time."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="bucketStartUtc"
                                tickFormatter={formatBucket}
                                minTickGap={24}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(value) => formatDateTime(String(value))}
                                formatter={(value: unknown) => formatDurationMs(Number(value))}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="avgLatencyMs" name="Average latency" stroke="#ffffff" />
                            <Line type="monotone" dataKey="p95LatencyMs" name="p95 latency" stroke="#10b981" />
                            <Line type="monotone" dataKey="p99LatencyMs" name="p99 latency" stroke="#f59e0b" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Top failing endpoints"
                description="Endpoints with the highest operational failure pressure."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={endpoints} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis type="number" />
                            <YAxis
                                type="category"
                                dataKey="endpointName"
                                width={180}
                            />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="failureRate" name="Failure rate" fill="#ef4444" />
                            <Bar dataKey="dlqEvents" name="DLQ events" fill="#f59e0b" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Top failing event types"
                description="Webhook event types that are causing the most reliability work."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={eventTypes} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis type="number" />
                            <YAxis
                                type="category"
                                dataKey="eventType"
                                width={180}
                            />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="failureRate" name="Failure rate" fill="#ef4444" />
                            <Bar dataKey="dlqEvents" name="DLQ events" fill="#f59e0b" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            <ChartCard
                title="Replay success trend"
                description="Whether operator recovery is actually helping."
            >
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={replays}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="bucketStartUtc"
                                tickFormatter={formatBucket}
                                minTickGap={24}
                            />
                            <YAxis />
                            <Tooltip
                                labelFormatter={(value) => formatDateTime(String(value))}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="totalReplayJobs" name="Replay jobs" stroke="#a855f7" />
                            <Line type="monotone" dataKey="replaySucceeded" name="Replay succeeded" stroke="#10b981" />
                            <Line type="monotone" dataKey="replayFailed" name="Replay failed" stroke="#ef4444" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        </div>
    );
}