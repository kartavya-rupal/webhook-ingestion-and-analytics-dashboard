import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { getReplayJobs } from '@/lib/api';
import { formatDateTime, formatStatusLabel, formatRelativeTime } from '@/lib/format';
import { getDashboardSession } from '@/lib/session';
import { getDashboardTenantLabel } from '@/lib/tenant-context';

type ReplayJobsPageSearchParams = {
    created?: string;
    eventId?: string;
    error?: string;
};

type ReplayJobsPageProps = {
    searchParams?: Promise<ReplayJobsPageSearchParams>;
};

function statusTone(status: string): string {
    switch (status) {
        case 'succeeded':
            return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20';
        case 'processing':
            return 'text-sky-300 bg-sky-500/15 border-sky-500/20';
        case 'failed':
            return 'text-amber-300 bg-amber-500/15 border-amber-500/20';
        default:
            return 'text-zinc-300 bg-white/5 border-white/10';
    }
}

export default async function ReplayJobsPage({
    searchParams,
}: ReplayJobsPageProps) {
    const resolved = (await searchParams) ?? {};
    const session = await getDashboardSession();
    const tenantLabel = await getDashboardTenantLabel();

    const jobsResponse = await getReplayJobs();
    const jobs = jobsResponse.items;

    const created = resolved.created === '1';
    const error = resolved.error === 'replay_failed';
    const eventId = resolved.eventId;

    return (
        <DashboardShell
            title="Replay jobs"
            description="A small operational log of replay requests. This shows what was requested, when it was requested, and which event it belongs to."
            tenantLabel={tenantLabel}
        >
            {created ? (
                <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
                    Replay job created successfully.
                    {eventId ? <span className="ml-1 font-medium">{eventId}</span> : null}
                </div>
            ) : null}

            {error ? (
                <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
                    Replay request failed. Check the API logs and try again.
                </div>
            ) : null}

            {jobs.length > 0 ? (
                <div className="space-y-4">
                    {jobs.map((job) => (
                        <article
                            key={job.id}
                            className="rounded-3xl border border-white/10 bg-white/5 p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                        Replay job
                                    </p>
                                    <h2 className="text-lg font-semibold tracking-tight text-white">
                                        {job.event?.eventType ?? job.eventId ?? 'Manual replay'}
                                    </h2>
                                    <p className="text-sm text-zinc-400">
                                        {job.id} · {job.tenant?.name ?? job.tenantId}
                                    </p>
                                </div>

                                <p
                                    className={[
                                        'rounded-full border px-3 py-1 text-xs font-medium',
                                        statusTone(job.replayStatus),
                                    ].join(' ')}
                                >
                                    {formatStatusLabel(job.replayStatus)}
                                </p>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                        Event
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-white">
                                        {job.event?.eventType ?? job.eventId ?? '—'}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                        Requested by
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-white">
                                        {job.requestedBy ?? '—'}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                        Created
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-white">
                                        {formatRelativeTime(job.createdAt)}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {formatDateTime(job.createdAt)}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                        Finished
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-white">
                                        {job.finishedAt ? formatDateTime(job.finishedAt) : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                {job.event?.id ? (
                                    <Link
                                        href={`/events/${job.event.id}`}
                                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                                    >
                                        Open event
                                    </Link>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                    No replay jobs have been created yet.
                </div>
            )}
        </DashboardShell>
    );
}