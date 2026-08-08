import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "./client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TenantContext = {
  authUserId: string;
  organizationId: string;
};

export async function applyRuntimeDatabaseRole(transaction: Prisma.TransactionClient) {
  await transaction.$executeRawUnsafe("SET LOCAL ROLE saring_app");
}

/**
 * Every tenant query must run through this transaction. PostgreSQL RLS fails
 * closed when either context value is missing. authUserId must come from a
 * verified Supabase claim, never from request input.
 */
export async function withTenantContext<T>(
  context: TenantContext,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if (!uuidPattern.test(context.authUserId) || !uuidPattern.test(context.organizationId)) {
    throw new Error("INVALID_TENANT_CONTEXT");
  }

  return getPrismaClient().$transaction(async (transaction) => {
    await applyRuntimeDatabaseRole(transaction);
    await transaction.$executeRaw`SELECT set_config('app.current_auth_user_id', ${context.authUserId}, true)`;

    const membership = await transaction.organizationMembership.findFirst({
      where: {
        organizationId: context.organizationId,
        user: { authUserId: context.authUserId, isActive: true },
      },
      select: { role: true },
    });
    if (!membership) throw new Error("FORBIDDEN");

    await transaction.$executeRaw`SELECT set_config('app.current_org_id', ${context.organizationId}, true)`;
    return operation(transaction);
  });
}
