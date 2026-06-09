// import Link from 'next/link';
// import { DashboardShell } from '@/components/DashboardShell';
// import {
//     getSearchAttempts,
//     getSearchEvents,
//     getSearchLogs,
//     getSearchPayloads,
//     getSearchReplays,
//     getSearchSuggestions,
//     resolveTimeRange,
//     type SearchAttemptItem,
//     type SearchEventItem,
//     type SearchKind,
//     type SearchLogItem,
//     type SearchPayloadItem,
//     type SearchQueryParams,
//     type SearchReplayItem,
//     type SearchSort,
//     type TimeRangePreset,
// } from '@/lib/search';
// import {
//     formatCount,
//     formatDateTime,
//     formatDurationMs,
//     formatRelativeTime,
//     formatStatusLabel,
// } from '@/lib/format';

// type SearchPageSearchParams = {
//     kind?: string;
//     q?: string;
//     tenantId?: string;
//     endpointId?: string;
//     providerSlug?: string;
//     status?: string;
//     range?: string;
//     from?: string;
//     to?: string;
//     sort?: string;
//     limit?: string;
//     offset?: string;
// };

// type SearchPageProps = {
//     searchParams?: Promise<SearchPageSearchParams>;
// };

// const DEFAULT_KIND: SearchKind = 'events';
// const DEFAULT_SORT: SearchSort = 'newest';
// const DEFAULT_RANGE: TimeRangePreset = '7d';

// const FAILURE_PATTERNS = [
//     { label: 'Signature mismatch', query: 'signature mismatch', kind: 'attempts' as const },
//     { label: 'Timeout', query: 'timeout', kind: 'attempts' as const },
//     { label: 'Invalid payload', query: 'invalid payload', kind: 'payloads' as const },
//     { label: 'Duplicate event', query: 'duplicate event', kind: 'events' as const },
//     { label: 'Downstream unavailable', query: 'downstream unavailable', kind: 'logs' as const },
//     { label: 'Response code 500', query: '500', kind: 'attempts' as const },
// ];

// function normalize(value?: string | string[]): string {
//     if (Array.isArray(value)) {
//         return value[0] ?? '';
//     }

//     return value ?? '';
// }

// function parseNumber(value: string | undefined, fallback: number): number {
//     if (!value) return fallback;

//     const parsed = Number.parseInt(value, 10);
//     if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
//         return fallback;
//     }

//     return parsed;
// }

// function buildQueryHref(
//     current: Record<string, string>,
//     overrides: Record<string, string | null | undefined>,
// ): string {
//     const params = new URLSearchParams();

//     const merged = {
//         ...current,
//         ...Object.fromEntries(
//             Object.entries(overrides).map(([key, value]) => [key, value ?? '']),
//         ),
//     };

//     for (const [key, value] of Object.entries(merged)) {
//         if (value.trim()) {
//             params.set(key, value.trim());
//         }
//     }

//     const query = params.toString();
//     return query ? `/search?${query}` : '/search';
// }

// function kindLabel(kind: SearchKind): string {
//     switch (kind) {
//         case 'attempts':
//             return 'Attempts';
//         case 'replays':
//             return 'Replays';
//         case 'logs':
//             return 'Logs';
//         case 'payloads':
//             return 'Payloads';
//         case 'events':
//         default:
//             return 'Events';
//     }
// }

// function rangeLabel(range: TimeRangePreset): string {
//     switch (range) {
//         case '15m':
//             return 'Last 15 minutes';
//         case '1h':
//             return 'Last hour';
//         case 'today':
//             return 'Today';
//         case 'yesterday':
//             return 'Yesterday';
//         case '7d':
//             return 'Last 7 days';
//         case 'custom':
//         default:
//             return 'Custom';
//     }
// }

// function toDateLabel(value?: string): string {
//     return value ? formatDateTime(value) : '—';
// }

// function SearchStatCard({
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

// function EventCard({ item }: { item: SearchEventItem }) {
//     return (
//         <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         {item.providerSlug}
//                     </p>
//                     <Link
//                         href={`/events/${item.id}`}
//                         className="mt-2 block text-lg font-semibold tracking-tight text-white hover:underline"
//                     >
//                         {item.eventType}
//                     </Link>
//                     <p className="mt-1 text-sm text-zinc-500">
//                         {item.id} · {item.externalEventId ?? 'no external id'}
//                     </p>
//                 </div>

//                 <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
//                     {formatStatusLabel(item.status)}
//                 </p>
//             </div>

//             <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Endpoint
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.endpointName}
//                     </p>
//                 </div>

//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Received
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatRelativeTime(item.receivedAt)}
//                     </p>
//                     <p className="mt-1 text-xs text-zinc-500">
//                         {formatDateTime(item.receivedAt)}
//                     </p>
//                 </div>

//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Attempts
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatCount(item.attemptCount)}
//                     </p>
//                 </div>

//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Replays
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatCount(item.replayCount)}
//                     </p>
//                 </div>
//             </div>

//             <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-400">
//                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
//                     {item.dedupeKey}
//                 </span>
//                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
//                     {item.payloadHash}
//                 </span>
//                 <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
//                     {item.requestIp ?? 'no request ip'}
//                 </span>
//             </div>
//         </article>
//     );
// }

// function AttemptCard({ item }: { item: SearchAttemptItem }) {
//     return (
//         <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Attempt #{item.attemptNumber}
//                     </p>
//                     <Link
//                         href={`/events/${item.eventId}#attempts`}
//                         className="mt-2 block text-lg font-semibold tracking-tight text-white hover:underline"
//                     >
//                         {item.eventType}
//                     </Link>
//                     <p className="mt-1 text-sm text-zinc-500">
//                         {item.id} · {item.externalEventId ?? 'no external id'}
//                     </p>
//                 </div>

//                 <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
//                     {formatStatusLabel(item.status)}
//                 </p>
//             </div>

//             <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Worker</p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.workerName ?? '—'}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Duration</p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatDurationMs(item.durationMs)}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Response code
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.responseCode ?? '—'}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Next retry
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.nextRetryAt ? formatDateTime(item.nextRetryAt) : '—'}
//                     </p>
//                 </div>
//             </div>

//             <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
//                 <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                     Error message
//                 </p>
//                 <p className="mt-2 text-sm text-zinc-300">
//                     {item.errorMessage ?? item.failureCategory ?? '—'}
//                 </p>
//             </div>
//         </article>
//     );
// }

// function ReplayCard({ item }: { item: SearchReplayItem }) {
//     return (
//         <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Replay
//                     </p>
//                     <Link
//                         href={`/events/${item.eventId ?? ''}`}
//                         className="mt-2 block text-lg font-semibold tracking-tight text-white hover:underline"
//                     >
//                         {item.eventType ?? 'Replay job'}
//                     </Link>
//                     <p className="mt-1 text-sm text-zinc-500">
//                         {item.id} · {item.requestedBy ?? 'unknown operator'}
//                     </p>
//                 </div>

//                 <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
//                     {formatStatusLabel(item.replayStatus)}
//                 </p>
//             </div>

//             <div className="mt-4 grid gap-3 md:grid-cols-2">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Tenant</p>
//                     <p className="mt-2 text-sm font-medium text-white">{item.tenantName}</p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Created</p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatRelativeTime(item.createdAt)}
//                     </p>
//                     <p className="mt-1 text-xs text-zinc-500">
//                         {formatDateTime(item.createdAt)}
//                     </p>
//                 </div>
//             </div>
//         </article>
//     );
// }

// function LogCard({ item }: { item: SearchLogItem }) {
//     return (
//         <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         {item.service}
//                     </p>
//                     <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">
//                         {item.message}
//                     </h3>
//                     <p className="mt-1 text-sm text-zinc-500">{item.id}</p>
//                 </div>

//                 <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
//                     {item.level}
//                 </p>
//             </div>

//             <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Event</p>
//                     <p className="mt-2 text-sm font-medium text-white">{item.eventId ?? '—'}</p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Attempt</p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.attemptNumber ?? '—'}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Replay job
//                     </p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {item.replayJobId ?? '—'}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Time</p>
//                     <p className="mt-2 text-sm font-medium text-white">
//                         {formatDateTime(item.timestamp)}
//                     </p>
//                 </div>
//             </div>

//             {item.errorMessage ? (
//                 <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Error</p>
//                     <p className="mt-2 text-sm text-zinc-300">{item.errorMessage}</p>
//                 </div>
//             ) : null}
//         </article>
//     );
// }

// function PayloadCard({ item }: { item: SearchPayloadItem }) {
//     return (
//         <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//                 <div>
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Payload preview
//                     </p>
//                     <Link
//                         href={`/events/${item.eventId}`}
//                         className="mt-2 block text-lg font-semibold tracking-tight text-white hover:underline"
//                     >
//                         {item.eventType}
//                     </Link>
//                     <p className="mt-1 text-sm text-zinc-500">
//                         {item.id} · {item.externalEventId ?? 'no external id'}
//                     </p>
//                 </div>

//                 <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
//                     {formatStatusLabel(item.status)}
//                 </p>
//             </div>

//             <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
//                 <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Preview</p>
//                 <p className="mt-2 text-sm text-zinc-300">{item.payloadPreview}</p>
//             </div>

//             <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Payload path
//                     </p>
//                     <p className="mt-2 break-all text-sm font-medium text-white">
//                         {item.payloadPath}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Payload hash
//                     </p>
//                     <p className="mt-2 break-all text-sm font-medium text-white">
//                         {item.payloadHash}
//                     </p>
//                 </div>
//                 <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Dedupe key
//                     </p>
//                     <p className="mt-2 break-all text-sm font-medium text-white">
//                         {item.dedupeKey}
//                     </p>
//                 </div>
//             </div>
//         </article>
//     );
// }

// export default async function SearchPage({ searchParams }: SearchPageProps) {
//     const resolved = (await searchParams) ?? {};

//     const kind = (normalize(resolved.kind) as SearchKind) || DEFAULT_KIND;
//     const q = normalize(resolved.q);
//     const tenantId = normalize(resolved.tenantId);
//     const endpointId = normalize(resolved.endpointId);
//     const providerSlug = normalize(resolved.providerSlug);
//     const status = normalize(resolved.status);
//     const range = (normalize(resolved.range) as TimeRangePreset) || DEFAULT_RANGE;
//     const from = normalize(resolved.from);
//     const to = normalize(resolved.to);
//     const sort = (normalize(resolved.sort) as SearchSort) || (q ? 'relevance' : DEFAULT_SORT);
//     const limit = parseNumber(resolved.limit, 20);
//     const offset = parseNumber(resolved.offset, 0);

//     const rangeBounds = resolveTimeRange(range);
//     const effectiveFrom = from || rangeBounds.from || undefined;
//     const effectiveTo = to || rangeBounds.to || undefined;

//     const baseFilters: SearchQueryParams = {
//         kind,
//         q: q || undefined,
//         tenantId: tenantId || undefined,
//         endpointId: endpointId || undefined,
//         providerSlug: providerSlug || undefined,
//         status: status || undefined,
//         range,
//         from: effectiveFrom,
//         to: effectiveTo,
//         sort,
//         limit,
//         offset,
//     };

//     const [results, suggestions] = await Promise.all([
//         (async () => {
//             switch (kind) {
//                 case 'attempts':
//                     return getSearchAttempts(baseFilters);
//                 case 'replays':
//                     return getSearchReplays(baseFilters);
//                 case 'logs':
//                     return getSearchLogs(baseFilters);
//                 case 'payloads':
//                     return getSearchPayloads(baseFilters);
//                 case 'events':
//                 default:
//                     return getSearchEvents(baseFilters);
//             }
//         })(),
//         getSearchSuggestions(baseFilters),
//     ]);

//     const hasPrev = results.page.offset > 0;
//     const hasNext = results.page.offset + results.page.limit < results.page.total;
//     const start = results.page.total === 0 ? 0 : results.page.offset + 1;
//     const end = Math.min(results.page.offset + results.items.length, results.page.total);
//     const windowLabel = from || to ? `${toDateLabel(from)} → ${toDateLabel(to)}` : rangeLabel(range);

//     const currentQueryState = {
//         kind,
//         q,
//         tenantId,
//         endpointId,
//         providerSlug,
//         status,
//         range,
//         from,
//         to,
//         sort,
//         limit: String(limit),
//         offset: String(offset),
//     };

//     const searchResultNodes =
//         kind === 'events'
//             ? (results.items as SearchEventItem[]).map((item) => <EventCard key={item.id} item={item} />)
//             : kind === 'attempts'
//                 ? (results.items as SearchAttemptItem[]).map((item) => (
//                     <AttemptCard key={item.id} item={item} />
//                 ))
//                 : kind === 'replays'
//                     ? (results.items as SearchReplayItem[]).map((item) => (
//                         <ReplayCard key={item.id} item={item} />
//                     ))
//                     : kind === 'logs'
//                         ? (results.items as SearchLogItem[]).map((item) => (
//                             <LogCard key={item.id} item={item} />
//                         ))
//                         : (results.items as SearchPayloadItem[]).map((item) => (
//                             <PayloadCard key={item.id} item={item} />
//                         ));

//     const firstResult = results.items[0] ?? null;

//     return (
//         <DashboardShell
//             title="Search"
//             description="Search events, attempts, replays, logs, and payload previews from the operator dashboard."
//             tenantLabel={tenantId || 'All tenants'}
//         >
//             <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
//                 <form method="get" className="grid gap-4 lg:grid-cols-4">
//                     <label className="space-y-2 lg:col-span-2">
//                         <span className="text-sm text-zinc-300">Search</span>
//                         <input
//                             name="q"
//                             defaultValue={q}
//                             placeholder="Event ID, failure reason, endpoint, payload text"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Kind</span>
//                         <select
//                             name="kind"
//                             defaultValue={kind}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         >
//                             <option value="events">Events</option>
//                             <option value="attempts">Attempts</option>
//                             <option value="replays">Replays</option>
//                             <option value="logs">Logs</option>
//                             <option value="payloads">Payloads</option>
//                         </select>
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Sort</span>
//                         <select
//                             name="sort"
//                             defaultValue={sort}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         >
//                             <option value="relevance">Relevance</option>
//                             <option value="newest">Newest first</option>
//                             <option value="oldest">Oldest first</option>
//                         </select>
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Range</span>
//                         <select
//                             name="range"
//                             defaultValue={range}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         >
//                             <option value="15m">Last 15 minutes</option>
//                             <option value="1h">Last hour</option>
//                             <option value="today">Today</option>
//                             <option value="yesterday">Yesterday</option>
//                             <option value="7d">Last 7 days</option>
//                             <option value="custom">Custom</option>
//                         </select>
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Tenant ID</span>
//                         <input
//                             name="tenantId"
//                             defaultValue={tenantId}
//                             placeholder="tenant_123"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Endpoint ID</span>
//                         <input
//                             name="endpointId"
//                             defaultValue={endpointId}
//                             placeholder="endpoint_123"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Provider slug</span>
//                         <input
//                             name="providerSlug"
//                             defaultValue={providerSlug}
//                             placeholder="mockpay"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">Status</span>
//                         <input
//                             name="status"
//                             defaultValue={status}
//                             placeholder="succeeded, failed_retryable, replay_failed"
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">From</span>
//                         <input
//                             name="from"
//                             type="date"
//                             defaultValue={from}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <label className="space-y-2">
//                         <span className="text-sm text-zinc-300">To</span>
//                         <input
//                             name="to"
//                             type="date"
//                             defaultValue={to}
//                             className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
//                         />
//                     </label>

//                     <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
//                         <button
//                             type="submit"
//                             className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
//                         >
//                             Search
//                         </button>
//                         <Link
//                             href="/search"
//                             className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                         >
//                             Reset
//                         </Link>
//                     </div>
//                 </form>
//             </section>

//             <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
//                 <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                     Failure patterns
//                 </p>
//                 <div className="mt-3 flex flex-wrap gap-2">
//                     {FAILURE_PATTERNS.map((pattern) => (
//                         <Link
//                             key={pattern.label}
//                             href={buildQueryHref(currentQueryState, {
//                                 kind: pattern.kind,
//                                 q: pattern.query,
//                                 offset: '0',
//                             })}
//                             className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-200 transition hover:bg-zinc-900"
//                         >
//                             {pattern.label}
//                         </Link>
//                     ))}
//                 </div>
//             </section>

//             {suggestions.items.length > 0 ? (
//                 <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
//                     <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                         Suggestions
//                     </p>
//                     <div className="mt-3 flex flex-wrap gap-2">
//                         {suggestions.items.map((item) => (
//                             <Link
//                                 key={item}
//                                 href={buildQueryHref(currentQueryState, {
//                                     q: item,
//                                     offset: '0',
//                                 })}
//                                 className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-200 transition hover:bg-zinc-900"
//                             >
//                                 {item}
//                             </Link>
//                         ))}
//                     </div>
//                 </section>
//             ) : null}

//             <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
//                 <SearchStatCard
//                     label="Results"
//                     value={formatCount(results.page.total)}
//                     hint={`Showing ${start} to ${end}`}
//                 />
//                 <SearchStatCard
//                     label="View"
//                     value={kindLabel(kind)}
//                     hint="Current search mode"
//                 />
//                 <SearchStatCard
//                     label="Sort"
//                     value={sort}
//                     hint="Current ordering"
//                 />
//                 <SearchStatCard
//                     label="Window"
//                     value={rangeLabel(range)}
//                     hint={windowLabel}
//                 />
//             </div>

//             <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
//                 <section className="space-y-4">
//                     <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
//                         <div className="flex flex-wrap items-center justify-between gap-3">
//                             <div>
//                                 <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                                     Search results
//                                 </p>
//                                 <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
//                                     {kindLabel(kind)} · {formatCount(results.page.total)} matches
//                                 </h2>
//                             </div>

//                             <div className="flex flex-wrap gap-2">
//                                 {hasPrev ? (
//                                     <Link
//                                         href={buildQueryHref(currentQueryState, {
//                                             offset: String(Math.max(0, results.page.offset - results.page.limit)),
//                                         })}
//                                         className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                     >
//                                         Previous
//                                     </Link>
//                                 ) : null}
//                                 {hasNext ? (
//                                     <Link
//                                         href={buildQueryHref(currentQueryState, {
//                                             offset: String(results.page.offset + results.page.limit),
//                                         })}
//                                         className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                     >
//                                         Next
//                                     </Link>
//                                 ) : null}
//                             </div>
//                         </div>
//                     </div>

//                     {results.items.length > 0 ? (
//                         <div className="space-y-4">{searchResultNodes}</div>
//                     ) : (
//                         <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
//                             No results matched the current filters.
//                         </div>
//                     )}
//                 </section>

//                 <aside className="space-y-4">
//                     <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
//                         <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                             Drilldown preview
//                         </p>

//                         {firstResult ? (
//                             <div className="mt-4 space-y-3">
//                                 <p className="text-lg font-semibold tracking-tight text-white">
//                                     {kindLabel(kind)} result
//                                 </p>

//                                 {kind === 'events' ? (
//                                     <>
//                                         <p className="text-sm text-zinc-300">
//                                             {(firstResult as SearchEventItem).eventType}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchEventItem).id}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchEventItem).endpointName}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {formatStatusLabel((firstResult as SearchEventItem).status)}
//                                         </p>
//                                         <Link
//                                             href={`/events/${(firstResult as SearchEventItem).id}`}
//                                             className="inline-block rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                         >
//                                             Open event
//                                         </Link>
//                                     </>
//                                 ) : null}

//                                 {kind === 'attempts' ? (
//                                     <>
//                                         <p className="text-sm text-zinc-300">
//                                             Attempt #{(firstResult as SearchAttemptItem).attemptNumber}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchAttemptItem).eventType}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchAttemptItem).errorMessage ?? (firstResult as SearchAttemptItem).failureCategory ?? 'No error text'}
//                                         </p>
//                                         <Link
//                                             href={`/events/${(firstResult as SearchAttemptItem).eventId}#attempts`}
//                                             className="inline-block rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                         >
//                                             Open event timeline
//                                         </Link>
//                                     </>
//                                 ) : null}

//                                 {kind === 'replays' ? (
//                                     <>
//                                         <p className="text-sm text-zinc-300">
//                                             {formatStatusLabel((firstResult as SearchReplayItem).replayStatus)}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchReplayItem).eventType ?? 'Replay job'}
//                                         </p>
//                                         <Link
//                                             href="/replay-jobs"
//                                             className="inline-block rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                         >
//                                             Open replay jobs
//                                         </Link>
//                                     </>
//                                 ) : null}

//                                 {kind === 'logs' ? (
//                                     <>
//                                         <p className="text-sm text-zinc-300">
//                                             {(firstResult as SearchLogItem).message}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchLogItem).service} · {(firstResult as SearchLogItem).level}
//                                         </p>
//                                         <Link
//                                             href={(firstResult as SearchLogItem).eventId ? `/events/${(firstResult as SearchLogItem).eventId}` : '/search'}
//                                             className="inline-block rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                         >
//                                             Open related event
//                                         </Link>
//                                     </>
//                                 ) : null}

//                                 {kind === 'payloads' ? (
//                                     <>
//                                         <p className="text-sm text-zinc-300">
//                                             {(firstResult as SearchPayloadItem).payloadPreview}
//                                         </p>
//                                         <p className="text-sm text-zinc-500">
//                                             {(firstResult as SearchPayloadItem).payloadPath}
//                                         </p>
//                                         <Link
//                                             href={`/events/${(firstResult as SearchPayloadItem).eventId}`}
//                                             className="inline-block rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
//                                         >
//                                             Open payload event
//                                         </Link>
//                                     </>
//                                 ) : null}
//                             </div>
//                         ) : (
//                             <div className="mt-4 space-y-3 text-sm text-zinc-400">
//                                 <p>No result selected yet.</p>
//                                 <p>
//                                     Try searching by event ID, provider slug, failure text, or a short payload snippet.
//                                 </p>
//                                 <p>
//                                     The API keeps the search contract stable so the backend can later move to OpenSearch without changing this page.
//                                 </p>
//                             </div>
//                         )}
//                     </div>

//                     <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
//                         <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
//                             Search tips
//                         </p>
//                         <div className="mt-4 space-y-3 text-sm text-zinc-400">
//                             <p>
//                                 Use exact statuses like <span className="text-zinc-200">succeeded</span>, <span className="text-zinc-200">failed_retryable</span>, or <span className="text-zinc-200">replay_failed</span>.
//                             </p>
//                             <p>Use the date filters to narrow an incident window.</p>
//                             <p>Use the failure patterns to jump into recurring incidents quickly.</p>
//                             <p>Open the event detail page when you need the full delivery timeline.</p>
//                         </div>
//                     </div>
//                 </aside>
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