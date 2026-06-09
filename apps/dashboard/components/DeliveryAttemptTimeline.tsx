import {
    formatDateTime,
    formatDurationMs,
    formatStatusLabel,
} from '@/lib/format';

type DeliveryAttempt = {
    id: string;
    eventId: string;
    attemptNumber: number;
    status: string;
    failureCategory: string | null;
    responseCode: number | null;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    nextRetryAt: string | null;
    workerName: string | null;
    createdAt: string;
};

type DeliveryAttemptTimelineProps = {
    attempts: DeliveryAttempt[];
};

function attemptTone(status: string): string {
    switch (status) {
        case 'succeeded':
            return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20';
        case 'retry_scheduled':
            return 'text-sky-300 bg-sky-500/15 border-sky-500/20';
        case 'failed':
            return 'text-amber-300 bg-amber-500/15 border-amber-500/20';
        default:
            return 'text-zinc-300 bg-white/5 border-white/10';
    }
}

export function DeliveryAttemptTimeline({
    attempts,
}: DeliveryAttemptTimelineProps) {
    if (!attempts.length) {
        return (
            <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 text-sm text-zinc-400">
                No delivery attempts recorded yet.
            </div>
        );
    }

    return (
        <ol className="space-y-4">
            {attempts.map((attempt, index) => (
                <li key={attempt.id} className="relative pl-6">
                    <div className="absolute left-1.5 top-6 h-full border-l border-white/10" />
                    <div className="absolute left-0 top-6 h-3 w-3 rounded-full border border-white/20 bg-zinc-950" />

                    <article className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Attempt #{attempt.attemptNumber}
                                </p>
                                <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">
                                    {attempt.status}
                                </h3>
                                <p className="mt-1 text-xs text-zinc-500">
                                    Created {formatDateTime(attempt.createdAt)} · Worker{' '}
                                    {attempt.workerName ?? '—'}
                                </p>
                            </div>

                            <p
                                className={[
                                    'rounded-full border px-3 py-1 text-xs font-medium',
                                    attemptTone(attempt.status),
                                ].join(' ')}
                            >
                                {formatStatusLabel(attempt.status)}
                            </p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Started at
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {attempt.startedAt ? formatDateTime(attempt.startedAt) : '—'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Finished at
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {attempt.finishedAt ? formatDateTime(attempt.finishedAt) : '—'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Duration
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {formatDurationMs(attempt.durationMs)}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Response code
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {attempt.responseCode ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Failure category
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {attempt.failureCategory ?? '—'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Next retry
                                </p>
                                <p className="mt-2 text-sm font-medium text-white">
                                    {attempt.nextRetryAt ? formatDateTime(attempt.nextRetryAt) : '—'}
                                </p>
                            </div>
                        </div>

                        {attempt.errorMessage ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                    Error message
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                                    {attempt.errorMessage}
                                </p>
                            </div>
                        ) : null}

                        <div className="mt-4 text-xs text-zinc-500">
                            Attempt timeline entry {index + 1} of {attempts.length}
                        </div>
                    </article>
                </li>
            ))}
        </ol>
    );
}