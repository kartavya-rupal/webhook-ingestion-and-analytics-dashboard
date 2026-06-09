import type { ReactNode } from 'react';

type DashboardPageShellProps = {
    title: string;
    description: string;
    children?: ReactNode;
};

export function DashboardPageShell({
    title,
    description,
    children,
}: DashboardPageShellProps) {
    return (
        <div className="space-y-6">
            <header className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                <p className="max-w-3xl text-sm text-zinc-400">{description}</p>
            </header>

            {children ? <div className="space-y-4">{children}</div> : null}
        </div>
    );
}