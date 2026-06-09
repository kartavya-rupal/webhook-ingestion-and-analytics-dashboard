export default function Loading() {
    return (
        <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
            <div className="mx-auto grid max-w-400px gap-6 lg:grid-cols-[280px_1fr]">
                <aside className="space-y-4">
                    <div className="h-8 w-32 animate-pulse rounded-2xl bg-white/10" />
                    <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
                    <div className="mt-8 space-y-3">
                        <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
                        <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
                        <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
                    </div>
                </aside>

                <main className="space-y-6">
                    <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                        <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                        <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                        <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                    </div>
                </main>
            </div>
        </div>
    );
}