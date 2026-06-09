type DashboardEmptyStateProps = {
    title: string;
    description: string;
};

export function DashboardEmptyState({
    title,
    description,
}: DashboardEmptyStateProps) {
    return (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
            <h3 className="text-lg font-semibold text-white">
                {title}
            </h3>

            <p className="mt-2 text-sm text-zinc-400">
                {description}
            </p>
        </div>
    );
}