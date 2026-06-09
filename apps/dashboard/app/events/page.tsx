import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { getEvents } from '@/lib/api';
import {
    formatCount,
    formatDateTime,
    formatRelativeTime,
    formatStatusLabel,
    isFailureStatus,
    isSuccessStatus,
} from '@/lib/format';
import { getDashboardSession } from '@/lib/session';
import { getDashboardTenantLabel } from '@/lib/tenant-context';

type EventsPageSearchParams = {
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
};

type EventsPageProps = {
    searchParams?: Promise<EventsPageSearchParams>;
};

function firstValue(value?: string | string[]): string {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
}

function normalizeString(value?: string | string[]): string {
    return firstValue(value).trim();
}

function parseNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
}

function buildQueryHref(
    current: Record<string, string | undefined>,
    overrides: Record<string, string | null | undefined>,
): string {
    const params = new URLSearchParams();

    const merged = {
        ...current,
        ...Object.fromEntries(
            Object.entries(overrides).map(([key, value]) => [key, value ?? '']),
        ),
    };

    for (const [key, value] of Object.entries(merged)) {
        if (value && value.trim()) {
            params.set(key, value.trim());
        }
    }

    const query = params.toString();
    return query ? `/events?${query}` : '/events';
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
    const resolved = (await searchParams) ?? {};
    const session = await getDashboardSession();
    const tenantLabel = await getDashboardTenantLabel();

    const filters = {
        tenantId: normalizeString(resolved.tenantId),
        endpointId: normalizeString(resolved.endpointId),
        providerSlug: normalizeString(resolved.providerSlug),
        status: normalizeString(resolved.status),
        q: normalizeString(resolved.q),
        from: normalizeString(resolved.from),
        to: normalizeString(resolved.to),
    };

    const limit = parseNumber(resolved.limit, 20);
    const offset = parseNumber(resolved.offset, 0);

    const { items, page } = await getEvents({
        tenantId: filters.tenantId || undefined,
        endpointId: filters.endpointId || undefined,
        providerSlug: filters.providerSlug || undefined,
        status: filters.status || undefined,
        q: filters.q || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit,
        offset,
    });

    const hasPrev = offset > 0;
    const hasNext = offset + page.limit < page.total;
    const start = page.total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + items.length, page.total);

    return (
        <DashboardShell
            title="Events"
            description="Search incoming webhook events, inspect their lifecycle state, and jump into a single event for deeper investigation."
            tenantLabel={tenantLabel}
        >
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <form method="get" className="grid gap-4 lg:grid-cols-3">
                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Search</span>
                        <input
                            name="q"
                            defaultValue={filters.q}
                            placeholder="Event ID, external event ID, or event type"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Status</span>
                        <select
                            name="status"
                            defaultValue={filters.status}
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        >
                            <option value="">All statuses</option>
                            <option value="queued">Queued</option>
                            <option value="processing">Processing</option>
                            <option value="succeeded">Succeeded</option>
                            <option value="failed_retryable">Failed retryable</option>
                            <option value="retry_scheduled">Retry scheduled</option>
                            <option value="failed_non_retryable">Failed non retryable</option>
                            <option value="moved_to_dlq">Moved to DLQ</option>
                            <option value="replay_requested">Replay requested</option>
                            <option value="replay_processing">Replay processing</option>
                            <option value="replay_succeeded">Replay succeeded</option>
                            <option value="replay_failed">Replay failed</option>
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Provider slug</span>
                        <input
                            name="providerSlug"
                            defaultValue={filters.providerSlug}
                            placeholder="mockpay"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Endpoint ID</span>
                        <input
                            name="endpointId"
                            defaultValue={filters.endpointId}
                            placeholder="endpoint_mockpay"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">From</span>
                        <input
                            name="from"
                            type="date"
                            defaultValue={filters.from}
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">To</span>
                        <input
                            name="to"
                            type="date"
                            defaultValue={filters.to}
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <div className="flex flex-wrap items-end gap-3 lg:col-span-3">
                        <button
                            type="submit"
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                        >
                            Apply filters
                        </button>

                        <Link
                            href="/events"
                            className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-900"
                        >
                            Reset
                        </Link>
                    </div>
                </form>
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            Results
                        </p>
                        <h2 className="mt-2 text-lg font-semibold tracking-tight">
                            {formatCount(page.total)} events
                        </h2>
                        <p className="mt-1 text-sm text-zinc-400">
                            Showing {start} to {end} of {formatCount(page.total)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {hasPrev ? (
                            <Link
                                href={buildQueryHref(filters, {
                                    offset: String(Math.max(0, offset - page.limit)),
                                })}
                                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                            >
                                Previous
                            </Link>
                        ) : null}

                        {hasNext ? (
                            <Link
                                href={buildQueryHref(filters, {
                                    offset: String(offset + page.limit),
                                })}
                                className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                            >
                                Next
                            </Link>
                        ) : null}
                    </div>
                </div>

                <div className="mt-5 space-y-3">
                    {items.length > 0 ? (
                        items.map((event) => {
                            const statusTone = isSuccessStatus(event.status)
                                ? 'text-emerald-300'
                                : isFailureStatus(event.status)
                                    ? 'text-amber-300'
                                    : 'text-zinc-300';

                            return (
                                <article
                                    key={event.id}
                                    className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 transition hover:border-white/20 hover:bg-zinc-900/80"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <Link
                                                href={`/events/${event.id}`}
                                                className="text-lg font-semibold tracking-tight text-white hover:underline"
                                            >
                                                {event.eventType}
                                            </Link>
                                            <p className="text-sm text-zinc-500">
                                                {event.id} · {event.externalEventId ?? 'no external id'}
                                            </p>
                                        </div>

                                        <p
                                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone}`}
                                        >
                                            {formatStatusLabel(event.status)}
                                        </p>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                                Tenant
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {event.tenant?.name ?? event.tenantId}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                                Endpoint
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {event.endpoint?.name ?? event.endpointId}
                                            </p>
                                            <Link
                                                href={buildQueryHref(filters, { endpointId: event.endpointId })}
                                                className="mt-2 inline-block text-xs text-zinc-400 underline decoration-white/20 underline-offset-4 hover:text-white"
                                            >
                                                Filter this endpoint
                                            </Link>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                                Received
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {formatRelativeTime(event.receivedAt)}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                {formatDateTime(event.receivedAt)}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                                Last updated
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {formatRelativeTime(event.lastUpdatedAt)}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                {formatDateTime(event.lastUpdatedAt)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                                            {event.providerSlug}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                                            {event.attemptCount} attempts
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                                            {event.replayCount} replays
                                        </span>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                            No events matched the current filters.
                        </div>
                    )}
                </div>
            </section>
        </DashboardShell>
    );
}