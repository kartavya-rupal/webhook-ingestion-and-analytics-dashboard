import type { DashboardUserRole } from '@/lib/session';

export function canReplay(role: DashboardUserRole): boolean {
    return role === 'admin' || role === 'operator';
}

export function canInspectSensitive(role: DashboardUserRole): boolean {
    return role === 'admin' || role === 'operator';
}

export function canManageEndpoints(role: DashboardUserRole): boolean {
    return role === 'admin';
}

export function canManageAlerts(role: DashboardUserRole): boolean {
    return role === 'admin';
}

export function canChangeAuthSettings(role: DashboardUserRole): boolean {
    return role === 'admin';
}