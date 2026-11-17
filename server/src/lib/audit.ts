import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Writes an append-only audit entry. Pass a transaction client as `db` to make
 * the entry commit (or roll back) together with the action it records.
 */
export async function logAudit(
  params: {
    actorId: number;
    action: string;
    targetTable: string;
    targetId: number;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  return db.auditLog.create({
    data: {
      actor_id: params.actorId,
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId,
    },
  });
}
