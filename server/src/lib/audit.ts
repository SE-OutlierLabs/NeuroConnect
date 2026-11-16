import { prisma } from './prisma.js';

export async function logAudit(params: {
  actorId: number;
  action: string;
  targetTable: string;
  targetId: number;
}) {
  return prisma.auditLog.create({
    data: {
      actor_id: params.actorId,
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId,
    },
  });
}