import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTenants } from '@/lib/api';
import { getDashboardSession } from '@/lib/session';

function TenantCard({
    tenant,
    canSelect,
}: {
    tenant: {
        id: string;
        name: string;
        status: string;
        endpointCount: number;
        eventCount: number;
        latestEvent: { receivedAt: string; status: string; eventType: string } | null;
    };
    canSelect: boolean;
}) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-semibold text-white">{tenant.name}</p>
                    <p className="text-sm text-zinc-400">{tenant.id}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                    {tenant.status}
                </span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between gap-3">
                    <span>Endpoints</span>
                    <span>{tenant.endpointCount}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span>Events</span>
                    <span>{tenant.eventCount}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span>Latest event</span>
                    <span>{tenant.latestEvent ? tenant.latestEvent.eventType : '—'}</span>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
                <Link
                    href={`/?tenant=${tenant.id}`}
                    className="rounded-full border border-white/10 bg-zinc-950/70 px-4 py-2 text-sm text-white"
                >
                    Open overview
                </Link>

                {canSelect ? (
                    <form action="/api/context/tenant" method="post">
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="next" value="/" />
                        <button className="rounded-full bg-white px-4 py-2 text-sm text-black">
                            Select tenant
                        </button>
                    </form>
                ) : null}
            </div>
        </div>
    );

}

export default async function TenantsPage() {
    const session = await getDashboardSession();

    if (!session) {
        redirect('/login');
    }

    const response = await getTenants();
    const tenants = response.items;

    if (session.role === 'admin') {
        return (
            <main className="min-h-screen bg-black px-6 py-10 text-white">
                <div className="mx-auto max-w-6xl">
                    <h1 className="text-3xl font-semibold">Tenants</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Admin can see every tenant and select one to drill down.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {tenants.map((tenant) => (
                            <TenantCard
                                key={tenant.id}
                                tenant={tenant}
                                canSelect
                            />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    const currentTenant = tenants.find((tenant) => tenant.id === session.tenantId);

    return (
        <main className="min-h-screen bg-black px-6 py-10 text-white">
            <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-semibold">Tenant</h1>
                <p className="mt-2 text-sm text-zinc-400">
                    Your account is locked to one tenant.
                </p>

                <div className="mt-8">
                    {currentTenant ? (
                        <TenantCard tenant={currentTenant} canSelect={false} />
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
                            Tenant not found for this session.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );

}