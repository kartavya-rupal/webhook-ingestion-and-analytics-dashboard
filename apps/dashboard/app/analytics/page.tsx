// import { AnalyticsCharts } from '@/components/AnalyticsCharts';
// import { AnalyticsOperationalSummary } from '@/components/AnalyticsOperationalSummary';
// import { DashboardShell } from '@/components/DashboardShell';
// import {
//     getAnalyticsOverview,
//     type AnalyticsQueryParams,
// } from '@/lib/analytics';
// import {
//     formatCount,
//     formatDurationMs,
//     formatPercentage,
// } from '@/lib/format';

// type AnalyticsPageSearchParams = {
//     range?: string | string[];
//     tenantId?: string | string[];
//     endpointId?: string | string[];
//     providerSlug?: string | string[];
//     eventType?: string | string[];
//     status?: string | string[];
//     from?: string | string[];
//     to?: string | string[];
// };

// type AnalyticsPageProps = {
//     searchParams?: Promise<AnalyticsPageSearchParams>;
// };

// function normalize(value?: string | string[]): string {
//     if (Array.isArray(value)) {
//         return value[0] ?? '';
//     }

//     return value ?? '';
// }

// function StatCard({
//     label,
//     value,
//     hint,
// }: {
//     label: string;
//     value: string;
//     hint: string;
// }) {
//     return (
//         <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
//             <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                 {label}
//             </p>
//             <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
//                 {value}
//             </p>
//             <p className="mt-2 text-sm text-zinc-400">{hint}</p>
//         </div>
//     );
// }

// export default async function AnalyticsPage({
//     searchParams,
// }: AnalyticsPageProps) {
//     const resolved = (await searchParams) ?? {};

//     const filters: AnalyticsQueryParams = {
//         range: normalize(resolved.range) as AnalyticsQueryParams['range'],
//         tenantId: normalize(resolved.tenantId) || undefined,
//         endpointId: normalize(resolved.endpointId) || undefined,
//         providerSlug: normalize(resolved.providerSlug) || undefined,
//         eventType: normalize(resolved.eventType) || undefined,
//         status: normalize(resolved.status) || undefined,
//         from: normalize(resolved.from) || undefined,
//         to: normalize(resolved.to) || undefined,
//     };

//     const overview = await getAnalyticsOverview(filters);

//     return (
//         <DashboardShell
//             title="Analytics"
//             description="A reliability analytics view for webhook volume, failure trends, retry behavior, DLQ movement, latency, and replay recovery."
//             tenantLabel={filters.tenantId ?? 'All tenants'}
//         >
//             <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
//                 <form method="get" className="grid gap-4 lg:grid-cols-4">
//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Range</span>
//                         <select
//                             name="range"
//                             defaultValue={filters.range ?? '7d'}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         >
//                             <option value="24h">Last 24 hours</option>
//                             <option value="7d">Last 7 days</option>
//                             <option value="30d">Last 30 days</option>
//                             <option value="90d">Last 90 days</option>
//                         </select>
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Tenant ID</span>
//                         <input
//                             name="tenantId"
//                             defaultValue={filters.tenantId}
//                             placeholder="tenant_123"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Endpoint ID</span>
//                         <input
//                             name="endpointId"
//                             defaultValue={filters.endpointId}
//                             placeholder="endpoint_123"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Provider slug</span>
//                         <input
//                             name="providerSlug"
//                             defaultValue={filters.providerSlug}
//                             placeholder="mockpay"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Event type</span>
//                         <input
//                             name="eventType"
//                             defaultValue={filters.eventType}
//                             placeholder="payment.succeeded"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Status</span>
//                         <select
//                             name="status"
//                             defaultValue={filters.status}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         >
//                             <option value="">All statuses</option>
//                             <option value="received">Received</option>
//                             <option value="verified">Verified</option>
//                             <option value="persisted">Persisted</option>
//                             <option value="queued">Queued</option>
//                             <option value="processing">Processing</option>
//                             <option value="succeeded">Succeeded</option>
//                             <option value="failed_retryable">Failed retryable</option>
//                             <option value="retry_scheduled">Retry scheduled</option>
//                             <option value="failed_non_retryable">Failed non retryable</option>
//                             <option value="moved_to_dlq">Moved to DLQ</option>
//                             <option value="replay_requested">Replay requested</option>
//                             <option value="replay_processing">Replay processing</option>
//                             <option value="replay_succeeded">Replay succeeded</option>
//                             <option value="replay_failed">Replay failed</option>
//                         </select>
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">From</span>
//                         <input
//                             name="from"
//                             type="date"
//                             defaultValue={filters.from}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">To</span>
//                         <input
//                             name="to"
//                             type="date"
//                             defaultValue={filters.to}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
//                         <button
//                             type="submit"
//                             className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
//                         >
//                             Apply filters
//                         </button>

//                         <a
//                             href="/analytics"
//                             className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                         >
//                             Reset
//                         </a>
//                     </div>
//                 </form>
//             </section>

//             <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
//                 <StatCard
//                     label="Total events"
//                     value={formatCount(overview.summary.totalEvents)}
//                     hint="All events in the selected range"
//                 />
//                 <StatCard
//                     label="Success rate"
//                     value={formatPercentage(overview.summary.successRate)}
//                     hint="Succeeded webhook events"
//                 />
//                 <StatCard
//                     label="Retry rate"
//                     value={formatPercentage(overview.summary.retryRate)}
//                     hint="Events needing another attempt"
//                 />
//                 <StatCard
//                     label="DLQ rate"
//                     value={formatPercentage(overview.summary.dlqRate)}
//                     hint="Events moved to dead-letter queue"
//                 />
//                 <StatCard
//                     label="Avg latency"
//                     value={formatDurationMs(overview.summary.avgLatencyMs)}
//                     hint="Average delivery time"
//                 />
//                 <StatCard
//                     label="Replay success"
//                     value={formatPercentage(overview.summary.replaySuccessRate)}
//                     hint="Replays that completed successfully"
//                 />
//             </div>

//             <div className="mt-6">
//                 <AnalyticsOperationalSummary overview={overview} filters={filters} />
//             </div>

//             <div className="mt-6">
//                 <AnalyticsCharts overview={overview} />
//             </div>
//         </DashboardShell>
//     );
// }

export default function Page() {
    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 p-10">
            <h1 className="text-3xl font-semibold">Coming later</h1>
            <p className="mt-3 text-zinc-400">
                This section is intentionally parked for the current release.
            </p>
        </main>
    );
}