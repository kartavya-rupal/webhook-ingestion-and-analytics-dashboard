'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV_ROUTES } from '@/lib/dashboard-routes';

function isActivePath(pathname: string, href: string): boolean {
    if (href === '/') {
        return pathname === '/';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex h-full flex-col gap-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                    FinRelay
                </p>
                <h2 className="text-xl font-semibold tracking-tight">Operator console</h2>
                <p className="text-sm text-zinc-400">
                    Internal views for webhook operations and delivery recovery.
                </p>
            </div>

            <nav className="space-y-1">
                {DASHBOARD_NAV_ROUTES.map((route) => {
                    const active = isActivePath(pathname, route.href);

                    return (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={[
                                'block rounded-2xl px-4 py-3 text-sm transition',
                                active
                                    ? 'bg-white text-zinc-950'
                                    : 'text-zinc-300 hover:bg-white/5 hover:text-white',
                            ].join(' ')}
                        >
                            <div className="font-medium">{route.label}</div>
                            <div className={active ? 'text-xs text-zinc-600' : 'text-xs text-zinc-500'}>
                                {route.description}
                            </div>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}