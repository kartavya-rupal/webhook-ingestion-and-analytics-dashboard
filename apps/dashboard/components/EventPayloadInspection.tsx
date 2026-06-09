'use client';

import Link from 'next/link';
import { useState } from 'react';

type EventPayloadInspectionProps = {
    eventId: string;
    eventType: string;
    externalEventId: string | null;
    dedupeKey: string;
    payloadPath: string;
    payloadHash: string;
    rawPayloadSize: number | null;
    requestIp: string | null;
    requestHeaders: Record<string, unknown> | null;
    payloadPreview: string;
    archivedPayloadHref: string;
    searchPayloadHref: string;
    canInspectSensitiveData: boolean;
};

function formatBytes(value: number | null): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }

    if (value < 1024) {
        return `${value} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let current = value / 1024;
    let unitIndex = 0;

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
    }

    return `${current.toFixed(current < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function KeyValue({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
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

function CopyButton({
    value,
    label,
}: {
    value: string;
    label: string;
}) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-white/10 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 transition hover:bg-zinc-800"
        >
            {copied ? 'Copied' : label}
        </button>
    );
}

export function EventPayloadInspection({
    eventId,
    eventType,
    externalEventId,
    dedupeKey,
    payloadPath,
    payloadHash,
    rawPayloadSize,
    requestIp,
    requestHeaders,
    payloadPreview,
    archivedPayloadHref,
    searchPayloadHref,
    canInspectSensitiveData,
}: EventPayloadInspectionProps) {
    const headersText =
        requestHeaders && Object.keys(requestHeaders).length > 0
            ? JSON.stringify(requestHeaders, null, 2)
            : '';

    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Payload inspection
                    </p>
                    <h2 className="text-lg font-semibold tracking-tight text-white">
                        Safe preview and archived payload
                    </h2>
                    <p className="text-sm text-zinc-400">
                        Inspect the safe preview first, then open the archived payload when you need the full body.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {canInspectSensitiveData ? (
                        <>
                            <a
                                href={archivedPayloadHref}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                            >
                                Open archived payload
                            </a>

                            <Link
                                href={searchPayloadHref}
                                className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                            >
                                Search payload text
                            </Link>
                        </>
                    ) : (
                        <div className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-400">
                            Payload inspection restricted
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <KeyValue
                    label="Event type"
                    value={eventType}
                />
                <KeyValue
                    label="External event id"
                    value={externalEventId ?? '—'}
                />
                <KeyValue
                    label="Dedupe key"
                    value={
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="break-all">{dedupeKey}</span>
                            <CopyButton value={dedupeKey} label="Copy" />
                        </div>
                    }
                />
                <KeyValue
                    label="Payload path"
                    value={
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="break-all">{payloadPath}</span>
                                <CopyButton value={payloadPath} label="Copy path" />
                            </div>
                        </div>
                    }
                />
                <KeyValue
                    label="Payload hash"
                    value={
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="break-all">{payloadHash}</span>
                            <CopyButton value={payloadHash} label="Copy hash" />
                        </div>
                    }
                />
                <KeyValue
                    label="Raw payload size"
                    value={formatBytes(rawPayloadSize)}
                />
                <KeyValue
                    label="Request IP"
                    value={requestIp ?? '—'}
                />
                <KeyValue
                    label="Event ID"
                    value={eventId}
                />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                    Safe payload preview
                </p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word text-sm leading-6 text-zinc-300">
                    {payloadPreview}
                </pre>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Request headers
                    </p>
                    {canInspectSensitiveData ? (
                        headersText ? (
                            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-6 text-zinc-300">
                                {headersText}
                            </pre>
                        ) : (
                            <p className="mt-3 text-sm text-zinc-400">
                                No request headers stored.
                            </p>
                        )
                    ) : (
                        <p className="mt-3 text-sm text-zinc-400">
                            Request headers are visible to operators and admins only.
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Inspection notes
                    </p>
                    <div className="mt-3 space-y-3 text-sm text-zinc-400">
                        <p>
                            Raw payload stays archived separately so operators can inspect the original body without mixing it into the search index.
                        </p>
                        <p>
                            Use the payload preview for quick diagnosis, then open the archived payload only when you need the full body.
                        </p>
                        <p>
                            Keep sensitive values redacted where possible before showing them in the dashboard.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}