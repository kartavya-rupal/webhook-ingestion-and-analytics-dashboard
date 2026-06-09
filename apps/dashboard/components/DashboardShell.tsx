import type { ReactNode } from 'react';
import { DashboardSidebar } from './DashboardSidebar';

type DashboardShellProps = {
    title: string;
    description: string;
    tenantLabel?: string;
    contextHint?: string;
    children: ReactNode;
};

export function DashboardShell({
    title,
    description,
    tenantLabel = 'FinRelay Demo',
    contextHint = 'Tenant scope is controlled by the current session.',
    children,
}: DashboardShellProps) {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="mx-auto grid min-h-screen max-w-400 lg:grid-cols-[280px_1fr]">
                <aside className="border-r border-white/10 bg-zinc-950/95 px-5 py-6">
                    <DashboardSidebar />

                    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            Active context
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-100">
                            {tenantLabel}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                            {contextHint}
                        </p>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-col">
                    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-zinc-950/90 px-6 py-4 backdrop-blur">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                Operator console
                            </p>
                            <p className="text-sm text-zinc-300">{tenantLabel}</p>
                        </div>

                        <form action="/api/auth/logout" method="post">
                            <button
                                type="submit"
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
                            >
                                Log out
                            </button>
                        </form>
                    </header>

                    <main className="flex-1 px-6 py-6">
                        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6">
                            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                                Dashboard
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                                {title}
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                                {description}
                            </p>
                        </section>

                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}