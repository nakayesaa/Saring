import "server-only";

import type { WorkspaceSession } from "@/lib/auth/session";
import type { OrganizationRole } from "@/lib/auth/permissions";
import { DomainError } from "@/lib/errors";
import { getPrismaClient } from "@/lib/db/client";
import { applyRuntimeDatabaseRole } from "@/lib/db/tenant";

export type WorkspacePrincipal = WorkspaceSession & {
  profileId: string;
  organizationId: string;
  organizationSlug: string;
  role: OrganizationRole;
};

export async function resolveWorkspacePrincipal(
  session: WorkspaceSession,
): Promise<WorkspacePrincipal> {
  const identity = await getPrismaClient().$transaction(async (transaction) => {
    await applyRuntimeDatabaseRole(transaction);
    await transaction.$executeRaw`SELECT set_config('app.current_auth_user_id', ${session.authUserId}, true)`;
    const membership = await transaction.organizationMembership.findFirst({
      where: { user: { authUserId: session.authUserId, isActive: true } },
      orderBy: { createdAt: "asc" },
      select: {
        organizationId: true,
        role: true,
        userId: true,
      },
    });
    if (!membership) return null;

    await transaction.$executeRaw`SELECT set_config('app.current_org_id', ${membership.organizationId}, true)`;
    const organization = await transaction.organization.findUnique({
      where: { id: membership.organizationId },
      select: { slug: true },
    });
    return organization ? { ...membership, organizationSlug: organization.slug } : null;
  });

  if (!identity) {
    throw new DomainError(
      "WORKSPACE_MEMBERSHIP_REQUIRED",
      "Your account has not been assigned to a SARING workspace.",
      403,
    );
  }

  return {
    ...session,
    profileId: identity.userId,
    organizationId: identity.organizationId,
    organizationSlug: identity.organizationSlug,
    role: identity.role,
  };
}
