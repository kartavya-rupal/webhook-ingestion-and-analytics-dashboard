import Link from 'next/link';
import type { ReactNode } from 'react';
import { DashboardApiError, getEvent } from '@/lib/api';
import {
    formatBytes,
    formatCount,
    formatDateTime,
    formatRelativeTime,
    formatStatusLabel,
    isFailureStatus,
    isSuccessStatus,
} from '@/lib/format';
import { DashboardShell } from '@/components/DashboardShell';
import { DeliveryAttemptTimeline } from '@/components/DeliveryAttemptTimeline';
import { EventPayloadInspection } from '@/components/EventPayloadInspection';
import { FailurePatternPanel } from '@/components/FailurePatternPanel';
import { getSearchPayloads } from '@/lib/search';
import { ReplayActionForm } from '@/components/ReplayActionForm';
import { canReplay } from '@/lib/permissions';
import { getDashboardSession } from '@/lib/session';

type EventDetailPageProps = {
    params?: Promise<{
        eventId?: string;
    }>;
};

function statusTone(status: string): string {
    if (isSuccessStatus(status)) {
        return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20';
    }

    if (isFailureStatus(status)) {
        return 'text-amber-300 bg-amber-500/15 border-amber-500/20';
    }

    if (status === 'processing' || status === 'queued') {
        return 'text-sky-300 bg-sky-500/15 border-sky-500/20';
    }

    return 'text-zinc-300 bg-white/5 border-white/10';
}

function InfoCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint: string;
}) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                {label}
            </p>
            <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                {value}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{hint}</p>
        </div>
    );
}

function KeyValue({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                {label}
            </p>
            <div className="mt-2 text-sm text-zinc-100">{value}</div>
        </div>
    );
}

export default async function EventDetailPage({
    params,
}: EventDetailPageProps) {
    const resolvedParams = (await params) ?? {};
    const eventId = resolvedParams.eventId;

    if (!eventId) {
        throw new Error('Not Found');
    }

    try {
        const session = await getDashboardSession();
        const replayAllowed = session ? canReplay(session.role) : false;
        const canInspectSensitiveData =
            session?.role === 'admin' || session?.role === 'operator';

        const { event } = await getEvent(eventId as string);

        const requestHeaders =
            event.requestHeaders &&
                typeof event.requestHeaders === 'object' &&
                !Array.isArray(event.requestHeaders)
                ? (event.requestHeaders as Record<string, unknown>)
                : null;

        const payloadPreviewResponse = canInspectSensitiveData
            ? await getSearchPayloads({
                q: event.id,
                tenantId: event.tenantId,
                endpointId: event.endpointId,
                providerSlug: event.providerSlug,
                limit: 1,
            }).catch(() => null)
            : null;

        const payloadPreview =
            payloadPreviewResponse?.items?.[0]?.payloadPreview ??
            `${event.eventType} • ${event.externalEventId ?? event.id}`;

        const failureSearchTerm =
            event.lastFailureReason ??
            event.lastFailureCategory ??
            event.eventType;

        const payloadSearchHref = `/search?kind=payloads&q=${encodeURIComponent(
            payloadPreview,
        )}`;

        return (
            <DashboardShell
                title={event.eventType}
                description="A full event investigation view with payload inspection, processing history, replay context, failure clues, and attempt timeline."
                tenantLabel={event.tenant?.name ?? 'Tenant scoped'}
            >
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Link
                        href="/events"
                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                    >
                        Back to events
                    </Link>

                    <Link
                        href={`/events?endpointId=${encodeURIComponent(event.endpointId)}`}
                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                    >
                        Filter this endpoint
                    </Link>

                    <Link
                        href={`/dlq?endpointId=${encodeURIComponent(event.endpointId)}`}
                        className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                    >
                        Open DLQ
                    </Link>

                    {canInspectSensitiveData ? (
                        <Link
                            href={payloadSearchHref}
                            className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                        >
                            Search payload
                        </Link>
                    ) : null}

                    <ReplayActionForm
                        eventId={event.id}
                        allowed={replayAllowed}
                        label="Replay event"
                        redirectTo="/replay-jobs"
                    />
                </div>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                                Event detail
                            </p>
                            <h1 className="text-3xl font-semibold tracking-tight text-white">
                                {event.eventType}
                            </h1>
                            <p className="text-sm text-zinc-400">
                                {event.id} · {event.externalEventId ?? 'no external event id'}
                            </p>
                        </div>

                        <div
                            className={`rounded-full border px-4 py-2 text-sm font-medium ${statusTone(
                                event.status,
                            )}`}
                        >
                            {formatStatusLabel(event.status)}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCard
                            label="Received"
                            value={formatRelativeTime(event.receivedAt)}
                            hint={formatDateTime(event.receivedAt)}
                        />
                        <InfoCard
                            label="Attempts"
                            value={formatCount(event.attemptCount)}
                            hint="All worker delivery attempts"
                        />
                        <InfoCard
                            label="Replays"
                            value={formatCount(event.replayCount)}
                            hint="Manual replay count"
                        />
                        <InfoCard
                            label="Raw payload"
                            value={formatBytes(event.rawPayloadSize)}
                            hint="Archived payload size"
                        />
                    </div>
                </section>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <section className="space-y-6">
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <div className="mb-4 space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight text-white">
                                    Event metadata
                                </h2>
                                <p className="text-sm text-zinc-400">
                                    The core operational fields for this webhook event.
                                </p>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <KeyValue
                                    label="Tenant"
                                    value={event.tenant?.name ?? event.tenantId}
                                />
                                <KeyValue
                                    label="Endpoint"
                                    value={event.endpoint?.name ?? event.endpointId}
                                />
                                <KeyValue
                                    label="Provider"
                                    value={event.providerSlug}
                                />
                                <KeyValue
                                    label="External event id"
                                    value={event.externalEventId ?? '—'}
                                />
                                <KeyValue
                                    label="Dedupe key"
                                    value={event.dedupeKey}
                                />
                                <KeyValue
                                    label="Request IP"
                                    value={event.requestIp ?? '—'}
                                />
                                <KeyValue
                                    label="Payload path"
                                    value={
                                        <span className="break-all">{event.payloadPath}</span>
                                    }
                                />
                                <KeyValue
                                    label="Payload hash"
                                    value={
                                        <span className="break-all">{event.payloadHash}</span>
                                    }
                                />
                                <KeyValue
                                    label="Queue message id"
                                    value={event.queueMessageId ?? '—'}
                                />
                                <KeyValue
                                    label="Signature verified"
                                    value={
                                        event.signatureVerifiedAt
                                            ? formatDateTime(event.signatureVerifiedAt)
                                            : '—'
                                    }
                                />
                                <KeyValue
                                    label="Queued at"
                                    value={
                                        event.queuedAt ? formatDateTime(event.queuedAt) : '—'
                                    }
                                />
                                <KeyValue
                                    label="Last updated"
                                    value={formatDateTime(event.lastUpdatedAt)}
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <div className="mb-4 space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight text-white">
                                    Processing timeline
                                </h2>
                                <p className="text-sm text-zinc-400">
                                    These timestamps show how the event moved through ingestion,
                                    queuing, worker processing, retry, and DLQ handling.
                                </p>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <KeyValue
                                    label="Processing started"
                                    value={
                                        event.processingStartedAt
                                            ? formatDateTime(event.processingStartedAt)
                                            : '—'
                                    }
                                />
                                <KeyValue
                                    label="Processing finished"
                                    value={
                                        event.processingFinishedAt
                                            ? formatDateTime(event.processingFinishedAt)
                                            : '—'
                                    }
                                />
                                <KeyValue
                                    label="Last attempt #"
                                    value={formatCount(event.lastAttemptNumber)}
                                />
                                <KeyValue
                                    label="Next retry at"
                                    value={
                                        event.nextRetryAt
                                            ? formatDateTime(event.nextRetryAt)
                                            : '—'
                                    }
                                />
                                <KeyValue
                                    label="DLQ moved at"
                                    value={
                                        event.dlqMovedAt
                                            ? formatDateTime(event.dlqMovedAt)
                                            : '—'
                                    }
                                />
                                <KeyValue
                                    label="Processed at"
                                    value={
                                        event.processedAt
                                            ? formatDateTime(event.processedAt)
                                            : '—'
                                    }
                                />
                            </div>
                        </section>

                        <EventPayloadInspection
                            eventId={event.id}
                            eventType={event.eventType}
                            externalEventId={event.externalEventId}
                            dedupeKey={event.dedupeKey}
                            payloadPath={event.payloadPath}
                            payloadHash={event.payloadHash}
                            rawPayloadSize={event.rawPayloadSize}
                            requestIp={event.requestIp}
                            requestHeaders={requestHeaders}
                            payloadPreview={payloadPreview}
                            archivedPayloadHref={`/api/events/${event.id}/payload`}
                            searchPayloadHref={payloadSearchHref}
                            canInspectSensitiveData={canInspectSensitiveData}
                        />

                        <FailurePatternPanel
                            searchTerm={failureSearchTerm}
                            tenantId={event.tenantId}
                            endpointId={event.endpointId}
                            providerSlug={event.providerSlug}
                            eventType={event.eventType}
                        />

                        <section
                            id="attempts"
                            className="rounded-3xl border border-white/10 bg-white/5 p-6"
                        >
                            <div className="mb-4 space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight text-white">
                                    Delivery attempt timeline
                                </h2>
                                <p className="text-sm text-zinc-400">
                                    Every worker attempt is shown in the order it happened.
                                </p>
                            </div>

                            <DeliveryAttemptTimeline attempts={event.attempts} />
                        </section>
                    </section>

                    <aside className="space-y-6">
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <h2 className="text-lg font-semibold tracking-tight text-white">
                                Recovery hints
                            </h2>
                            <div className="mt-4 space-y-3 text-sm text-zinc-400">
                                <p>
                                    Raw payload stays archived in object storage, so the original
                                    event can be replayed later without relying on the live request.
                                </p>
                                <p>
                                    The payload inspection panel shows a safe preview first, then
                                    opens the archived payload when you need the full body.
                                </p>
                                <p>
                                    The failure pattern shortcuts make it easy to jump to similar
                                    events, attempts, logs, or payloads from this screen.
                                </p>
                                <p>
                                    If the event is in a failure state, the timeline is usually the
                                    quickest way to understand where the processing path broke.
                                </p>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <h2 className="text-lg font-semibold tracking-tight text-white">
                                Recovery actions
                            </h2>
                            <p className="mt-2 text-sm text-zinc-400">
                                Replay is available to operators and admins only.
                            </p>
                            <div className="mt-4">
                                <ReplayActionForm
                                    eventId={event.id}
                                    allowed={replayAllowed}
                                    label="Replay event"
                                    redirectTo="/replay-jobs"
                                />
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                            <h2 className="text-lg font-semibold tracking-tight text-white">
                                Current event snapshot
                            </h2>
                            <div className="mt-5 space-y-3 text-sm text-zinc-300">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Tenant</span>
                                    <span>{event.tenant?.name ?? event.tenantId}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Endpoint</span>
                                    <span>{event.endpoint?.name ?? event.endpointId}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Provider</span>
                                    <span>{event.providerSlug}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Status</span>
                                    <span>{formatStatusLabel(event.status)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Attempts</span>
                                    <span>{formatCount(event.attemptCount)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Replays</span>
                                    <span>{formatCount(event.replayCount)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Failure</span>
                                    <span>
                                        {event.lastFailureReason ??
                                            event.lastFailureCategory ??
                                            '—'}
                                    </span>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            </DashboardShell>
        );
    } catch (error) {
        if (error instanceof DashboardApiError) {
            const status = (error as { status?: number }).status;
            if (status === 404) {
                throw new Error('Not Found');
            }
        }

        return (
            <DashboardShell
                title="Event detail"
                description="Something went wrong while loading this event."
            >
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
                    <p className="font-medium text-white">Could not load event</p>
                    <p className="mt-2 text-zinc-400">
                        {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                    <div className="mt-4">
                        <Link
                            href="/events"
                            className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                        >
                            Back to events
                        </Link>
                    </div>
                </div>
            </DashboardShell>
        );
    }
}