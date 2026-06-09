import crypto from 'node:crypto';
import type { DashboardSession, DashboardUserRole } from './session';

type RoleCredentials = {
    role: DashboardUserRole;
    email: string;
    password: string;
    tenantId: string | null;
    name: string;
};

function timingSafeStringEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);

}

function getRoleCredentials(): RoleCredentials[] {
    return [
        {
            role: 'admin',
            email: (process.env.DASHBOARD_ADMIN_EMAIL ?? '').trim().toLowerCase(),
            password: process.env.DASHBOARD_ADMIN_PASSWORD ?? '',
            tenantId: null,
            name: 'Dashboard Admin',
        },
        {
            role: 'operator',
            email: (process.env.DASHBOARD_OPERATOR_EMAIL ?? '').trim().toLowerCase(),
            password: process.env.DASHBOARD_OPERATOR_PASSWORD ?? '',
            tenantId:
                (process.env.DASHBOARD_OPERATOR_TENANT_ID ?? '').trim() || null,
            name: 'Dashboard Operator',
        },
        {
            role: 'viewer',
            email: (process.env.DASHBOARD_VIEWER_EMAIL ?? '').trim().toLowerCase(),
            password: process.env.DASHBOARD_VIEWER_PASSWORD ?? '',
            tenantId:
                (process.env.DASHBOARD_VIEWER_TENANT_ID ?? '').trim() || null,
            name: 'Dashboard Viewer',
        },
    ];
}

export function authenticateDashboardLogin(
    email: string,
    password: string,
): DashboardSession | null {
    const normalizedEmail = email.trim().toLowerCase();

    for (const candidate of getRoleCredentials()) {
        if (
            candidate.email === normalizedEmail &&
            timingSafeStringEqual(candidate.password, password)
        ) {
            return {
                email: candidate.email,
                name: candidate.name,
                role: candidate.role,
                tenantId: candidate.tenantId,
            };
        }
    }

    return null;

}

export function isValidDashboardLogin(email: string, password: string): boolean {
    return authenticateDashboardLogin(email, password) !== null;
}