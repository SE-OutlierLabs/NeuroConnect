import { PrismaClient } from '@prisma/client';

// One shared Prisma client for the whole server (avoids opening many database connections).
export const prisma = new PrismaClient();