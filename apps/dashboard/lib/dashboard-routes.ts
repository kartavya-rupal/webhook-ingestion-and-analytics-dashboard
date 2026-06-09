export type DashboardRoute = {
    href: string;
    label: string;
    description: string;
    requiresAuth: boolean;
    showInNav: boolean;
};

export const DASHBOARD_ROUTES: DashboardRoute[] = [
    {
        href: '/',
        label: 'Overview',
        description: 'System snapshot and operational summary',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/tenants',
        label: 'Tenants',
        description: 'Tenant list and tenant summary views',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/endpoints',
        label: 'Endpoints',
        description: 'Endpoint inventory and endpoint health',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/events',
        label: 'Events',
        description: 'Webhook event list and lifecycle search',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/dlq',
        label: 'DLQ',
        description: 'Dead-letter queue inspection and failure review',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/replay-jobs',
        label: 'Replay Jobs',
        description: 'Manual replay history and replay status',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/login',
        label: 'Login',
        description: 'Authentication entry point',
        requiresAuth: false,
        showInNav: false,
    },
    {
        href: '/analytics',
        label: 'Analytics',
        description: 'Reliability trends and charts',
        requiresAuth: true,
        showInNav: true,
    },
    {
        href: '/search',
        label: 'Search',
        description: 'Incident investigation and payload search',
        requiresAuth: true,
        showInNav: true,
    }
] as const;

export const DASHBOARD_NAV_ROUTES = DASHBOARD_ROUTES.filter(
    (route) => route.showInNav,
);

export function getDashboardRouteByHref(href: string) {
    return DASHBOARD_ROUTES.find((route) => route.href === href);
}