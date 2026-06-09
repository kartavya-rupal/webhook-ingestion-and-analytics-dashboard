import { db } from '@finrelay/db';
import { redactSensitiveObject } from '@finrelay/shared';

export type AuditActorType = 'user' | 'system';

export async function recordAuditEvent(input: {
    tenantId: string;
    actorType: AuditActorType;
    actorId?: string | null;
    actionType: string;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
}): Promise<void> {
    await db.auditLog.create({
        data: {
            tenantId: input.tenantId,
            actorType: input.actorType,
            actorId: input.actorId ?? null,
            actionType: input.actionType,
            metadata: redactSensitiveObject({
                entityType: input.entityType ?? null,
                entityId: input.entityId ?? null,
                ...(input.metadata ?? {}),
            }),
        },
    });
}