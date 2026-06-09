import Link from 'next/link';
import type { SearchKind } from '@/lib/search';

type FailurePatternPanelProps = {
    searchTerm?: string;
    tenantId?: string;
    endpointId?: string;
    providerSlug?: string;
    eventType?: string;
    from?: string;
    to?: string;
};

type PatternLink = {
    label: string;
    kind: SearchKind;
    query: string;
    tone: 'events' | 'attempts' | 'logs' | 'payloads';
};

function buildHref(
    kind: SearchKind,
    query: string,
    filters: Pick<
        FailurePatternPanelProps,
        'tenantId' | 'endpointId' | 'providerSlug' | 'eventType' | 'from' | 'to'
    >,
): string {
    const params = new URLSearchParams();

    params.set('kind', kind);
    params.set('q', query);

    if (filters.tenantId) params.set('tenantId', filters.tenantId);
    if (filters.endpointId) params.set('endpointId', filters.endpointId);
    if (filters.providerSlug) params.set('providerSlug', filters.providerSlug);
    if (filters.eventType) params.set('eventType', filters.eventType);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    return `/search?${params.toString()}`;
}

const COMMON_PATTERNS: PatternLink[] = [
    { label: 'Signature mismatch', kind: 'attempts', query: 'signature mismatch', tone: 'attempts' },
    { label: 'Timeout', kind: 'attempts', query: 'timeout', tone: 'attempts' },
    { label: 'Invalid payload', kind: 'payloads', query: 'invalid payload', tone: 'payloads' },
    { label: 'Duplicate event', kind: 'events', query: 'duplicate event', tone: 'events' },
    { label: 'Downstream unavailable', kind: 'logs', query: 'downstream unavailable', tone: 'logs' },
    { label: 'Response code 500', kind: 'attempts', query: '500', tone: 'attempts' },
];

export function FailurePatternPanel({
    searchTerm,
    tenantId,
    endpointId,
    providerSlug,
    eventType,
    from,
    to,
}: FailurePatternPanelProps) {
    const filters = { tenantId, endpointId, providerSlug, eventType, from, to };

    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                    Failure patterns
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                    Find related failures fast
                </h2>
                <p className="text-sm text-zinc-400">
                    Use these shortcuts to jump into similar attempts, events, logs, and payloads.
                </p>
            </div>

            {searchTerm ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Current failure clue
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">{searchTerm}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                            href={buildHref('attempts', searchTerm, filters)}
                            className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                        >
                            Search attempts
                        </Link>
                        <Link
                            href={buildHref('logs', searchTerm, filters)}
                            className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                        >
                            Search logs
                        </Link>
                        <Link
                            href={buildHref('events', searchTerm, filters)}
                            className="rounded-full border border-white/10 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                        >
                            Search events
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                    Common patterns
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {COMMON_PATTERNS.map((pattern) => (
                        <Link
                            key={pattern.label}
                            href={buildHref(pattern.kind, pattern.query, filters)}
                            className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-200 transition hover:bg-zinc-900"
                        >
                            {pattern.label}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Link
                    href={buildHref('events', 'duplicate event', filters)}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Same event shape
                </Link>
                <Link
                    href={buildHref('attempts', 'timeout', filters)}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Same timeout pattern
                </Link>
                <Link
                    href={buildHref('logs', '500', filters)}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Same server error
                </Link>
                <Link
                    href={buildHref('payloads', 'invalid payload', filters)}
                    className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                    Same payload clue
                </Link>
            </div>
        </section>
    );
}