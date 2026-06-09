type ReplayActionFormProps = {
    eventId: string;
    allowed: boolean;
    label?: string;
    redirectTo?: string;
    className?: string;
};

export function ReplayActionForm({
    eventId,
    allowed,
    label = 'Replay event',
    redirectTo = '/replay-jobs',
    className = '',
}: ReplayActionFormProps) {
    if (!allowed) {
        return null;
    }

    return (
        <form
            action={`/api/replay/${encodeURIComponent(eventId)}`}
            method="post"
            className={`space-y-3 ${className}`.trim()}
        >
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <button
                type="submit"
                className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            >
                {label}
            </button>
        </form>
    );
}