export const USER_ROLES = ['admin', 'operator', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];