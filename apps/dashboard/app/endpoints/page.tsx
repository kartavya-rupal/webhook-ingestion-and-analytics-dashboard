import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { getEndpoints } from '@/lib/api';
import {
    formatCount,
    formatDateTime,
    formatJsonPreview,
    formatPercentage,
    formatRelativeTime,
    formatStatusLabel,
} from '@/lib/format';
import { getDashboardSession } from '@/lib/session';
import { getDashboardTenantLabel } from '@/lib/tenant-context';

function EndpointCard({
    endpoint,
}: {
    endpoint: Awaited<ReturnType<typeof getEndpoints>>['items'][number];
}) {
    const failureRate =
        endpoint.eventCount > 0 ? endpoint.failureCount / endpoint.eventCount : 0;

    return (
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        {endpoint.providerSlug}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                        {endpoint.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">{endpoint.url}</p>
                </div>

                <p
                    className={[
                        'rounded-full px-3 py-1 text-xs font-medium',
                        endpoint.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-500/15 text-zinc-300',
                    ].join(' ')}
                >
                    {formatStatusLabel(endpoint.status)}
                </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Total events
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCount(endpoint.eventCount)}
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Failure rate
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {formatPercentage(failureRate)}
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Last received
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                        {endpoint.latestEvent
                            ? formatRelativeTime(endpoint.latestEvent.receivedAt)
                            : '—'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        {endpoint.latestEvent
                            ? formatDateTime(endpoint.latestEvent.receivedAt)
                            : 'No events yet'}
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Retry policy
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                        {formatJsonPreview(endpoint.retryPolicy, 90)}
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-zinc-400">
                    {endpoint.latestEvent
                        ? `Latest event: ${endpoint.latestEvent.eventType} · ${formatStatusLabel(endpoint.latestEvent.status)}`
                        : 'No recent activity recorded'}
                </p>

                <Link
                    href={`/events?endpointId=${encodeURIComponent(endpoint.id)}`}
                    className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                >
                    View events
                </Link>
            </div>
        </article>
    );
}

export default async function EndpointsPage() {
    const session = await getDashboardSession();
    const tenantLabel = await getDashboardTenantLabel();
    const { items } = await getEndpoints();

    return (
        <DashboardShell
            title="Endpoints"
            description="A compact inventory of all configured endpoints, their health, and a direct path into filtered event investigation."
            tenantLabel={tenantLabel}
        >
            {items.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {items.map((endpoint) => (
                        <EndpointCard key={endpoint.id} endpoint={endpoint} />
                    ))}
                </div>
            ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                    No endpoints found yet. Add one in Prisma Studio and refresh this page.
                </div>
            )}
        </DashboardShell>
    );
}