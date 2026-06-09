import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { getDlqItems } from '@/lib/api';
import {
    formatCount,
    formatDateTime,
    formatRelativeTime,
    formatStatusLabel,
    isFailureStatus,
    isSuccessStatus,
} from '@/lib/format';
import { ReplayActionForm } from '@/components/ReplayActionForm';
import { canReplay } from '@/lib/permissions';
import { getDashboardSession } from '@/lib/session';
import { getDashboardTenantLabel } from '@/lib/tenant-context';

type DlqPageSearchParams = {
    tenantId?: string;
    providerSlug?: string;
    status?: string;
    q?: string;
    limit?: string;
    offset?: string;
};

type DlqPageProps = {
    searchParams?: Promise<DlqPageSearchParams>;
};

function normalize(value?: string | string[]): string {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
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
    current: Record<string, string>,
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
        if (value.trim()) {
            params.set(key, value.trim());
        }
    }

    const query = params.toString();
    return query ? `/dlq?${query}` : '/dlq';
}

function statusTone(status: string): string {
    if (isSuccessStatus(status)) {
        return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20';
    }

    if (isFailureStatus(status)) {
        return 'text-amber-300 bg-amber-500/15 border-amber-500/20';
    }

    return 'text-zinc-300 bg-white/5 border-white/10';
}

export default async function DlqPage({ searchParams }: DlqPageProps) {
    const resolved = (await searchParams) ?? {};

    const session = await getDashboardSession();
    const replayAllowed = session ? canReplay(session.role) : false;
    const tenantLabel = await getDashboardTenantLabel();

    const filters = {
        tenantId: normalize(resolved.tenantId),
        providerSlug: normalize(resolved.providerSlug),
        status: normalize(resolved.status),
        q: normalize(resolved.q),
    };

    const limit = parseNumber(resolved.limit, 20);
    const offset = parseNumber(resolved.offset, 0);

    const { items, page } = await getDlqItems({
        tenantId: filters.tenantId || undefined,
        providerSlug: filters.providerSlug || undefined,
        status: filters.status || undefined,
        q: filters.q || undefined,
        limit,
        offset,
    });

    const hasPrev = offset > 0;
    const hasNext = offset + page.limit < page.total;
    const start = page.total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + items.length, page.total);

    return (
        <DashboardShell
            title="DLQ"
            description="A quarantine view for failed events that were moved out of the main processing flow. Use it to inspect failure details and trigger recovery."
            tenantLabel={tenantLabel}
        >
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <form method="get" className="grid gap-4 lg:grid-cols-4">
                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Search</span>
                        <input
                            name="q"
                            defaultValue={filters.q}
                            placeholder="Event ID, reason, type, dedupe key"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm text-zinc-300">Tenant ID</span>
                        <input
                            name="tenantId"
                            defaultValue={filters.tenantId}
                            placeholder="tenant_demo"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        />
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
                        <span className="text-sm text-zinc-300">Status</span>
                        <select
                            name="status"
                            defaultValue={filters.status}
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-white/20"
                        >
                            <option value="">All DLQ states</option>
                            <option value="moved_to_dlq">Moved to DLQ</option>
                            <option value="failed_non_retryable">Failed non retryable</option>
                        </select>
                    </label>

                    <div className="flex flex-wrap items-end gap-3 lg:col-span-4">
                        <button
                            type="submit"
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                        >
                            Apply filters
                        </button>

                        <Link
                            href="/dlq"
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
                            DLQ results
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

                <div className="mt-5 space-y-4">
                    {items.length > 0 ? (
                        items.map((event) => (
                            <article
                                key={event.id}
                                className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5"
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
                                        className={[
                                            'rounded-full border px-3 py-1 text-xs font-medium',
                                            statusTone(event.status),
                                        ].join(' ')}
                                    >
                                        {formatStatusLabel(event.status)}
                                    </p>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                            Provider
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {event.providerSlug}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                            Failure reason
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {event.lastFailureReason ?? '—'}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                            Attempts
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {formatCount(event.attemptCount)}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                            DLQ moved at
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-white">
                                            {event.dlqMovedAt
                                                ? formatRelativeTime(event.dlqMovedAt)
                                                : '—'}
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            {event.dlqMovedAt
                                                ? formatDateTime(event.dlqMovedAt)
                                                : 'No DLQ timestamp'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <Link
                                        href={`/events/${event.id}#attempts`}
                                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                                    >
                                        Open detail
                                    </Link>

                                    <Link
                                        href={`/events/${event.id}`}
                                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                                    >
                                        Inspect event
                                    </Link>

                                    <ReplayActionForm
                                        eventId={event.id}
                                        allowed={replayAllowed}
                                        label="Replay"
                                        redirectTo="/replay-jobs"
                                    />
                                </div>
                            </article>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                            No DLQ events matched the current filters.
                        </div>
                    )}
                </div>
            </section>
        </DashboardShell>
    );
}