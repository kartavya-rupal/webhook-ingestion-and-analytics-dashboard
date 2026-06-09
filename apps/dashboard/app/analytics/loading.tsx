import { DashboardShell } from '@/components/DashboardShell';

export default function Loading() {
    return (
        <DashboardShell
            title="Analytics"
            description="Loading analytics charts..."
        >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                Loading analytics...
            </div>
        </DashboardShell>
    );
}