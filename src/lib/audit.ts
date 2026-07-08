import { prisma } from './db';

/** Central audit trail (PRD §5.1, §10.2): KYC bypasses, alerts, deviations, admin actions. */
export async function audit(
  action: string,
  opts: { actorId?: string; entity?: string; entityId?: string; detail?: object } = {}
) {
  await prisma.auditLog.create({
    data: {
      action,
      actorId: opts.actorId,
      entity: opts.entity,
      entityId: opts.entityId,
      detail: opts.detail as any,
    },
  });
}
