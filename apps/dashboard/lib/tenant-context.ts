import { getTenants } from './api';
import {
    getDashboardSelectedTenantId,
    getDashboardSession,
} from './session';

export async function getDashboardTenantLabel(): Promise<string> {
    const session = await getDashboardSession();

    if (!session) {
        return 'Tenant scoped';
    }

    const tenantsResponse = await getTenants().catch(() => ({ items: [] as Array<{ id: string; name: string }> }));

    if (session.role === 'admin') {
        const selectedTenantId = await getDashboardSelectedTenantId();

        if (!selectedTenantId) {
            return 'All tenants';
        }

        const selectedTenant = tenantsResponse.items.find(
            (tenant) => tenant.id === selectedTenantId,
        );

        return selectedTenant?.name ?? 'Selected tenant';
    }

    const tenant = tenantsResponse.items.find(
        (item) => item.id === session.tenantId,
    );

    return tenant?.name ?? 'Tenant scoped';
}