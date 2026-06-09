type LoginPageProps = {
    searchParams?: Promise<{
        error?: string;
        next?: string;
    }>;
};

function sanitizeNextPath(value?: string): string {
    if (!value || !value.startsWith('/')) {
        return '/';
    }

    return value;
}

function getLocalCredentials() {
    return [
        {
            label: 'Admin',
            email: process.env.DASHBOARD_ADMIN_EMAIL ?? 'admin@finrelay.local',
        },
        {
            label: 'Operator',
            email: process.env.DASHBOARD_OPERATOR_EMAIL ?? 'operator@finrelay.local',
        },
        {
            label: 'Viewer',
            email: process.env.DASHBOARD_VIEWER_EMAIL ?? 'viewer@finrelay.local',
        },
    ];
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = (await searchParams) ?? {};
    const error = resolvedSearchParams.error === 'invalid_credentials';
    const nextPath = sanitizeNextPath(resolvedSearchParams.next);

    const localCredentials = getLocalCredentials();

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                        FinRelay
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Sign in to the dashboard
                    </h1>
                    <p className="text-sm text-zinc-400">
                        Use one of the local role credentials configured in{' '}
                        <span className="font-medium text-zinc-300">
                            apps/dashboard/.env.local
                        </span>
                        .
                    </p>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Local roles
                    </p>
                    <div className="mt-3 space-y-2">
                        {localCredentials.map((item) => (
                            <div
                                key={item.label}
                                className="flex items-center justify-between gap-3"
                            >
                                <span className="text-zinc-400">{item.label}</span>
                                <span className="font-medium text-zinc-100">
                                    {item.email}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {error ? (
                    <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        Invalid email or password.
                    </div>
                ) : null}

                <form
                    className="mt-6 space-y-4"
                    action="/api/auth/login"
                    method="post"
                >
                    <input type="hidden" name="next" value={nextPath} />

                    <label className="block space-y-2">
                        <span className="text-sm text-zinc-300">Email</span>
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-white/20"
                            placeholder="admin@finrelay.local"
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm text-zinc-300">Password</span>
                        <input
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-white/20"
                            placeholder="••••••••"
                            required
                        />
                    </label>

                    <button
                        type="submit"
                        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                    >
                        Sign in
                    </button>
                </form>
            </div>
        </main>
    );
}