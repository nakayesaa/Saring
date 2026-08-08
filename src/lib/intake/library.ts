import "server-only";

import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { withTenantContext } from "@/lib/db/tenant";

export type StoredPackageOption = {
  id: string;
  name: string;
  context: string;
  records: string;
};

export function listStoredPackages(principal: WorkspacePrincipal) {
  return withTenantContext(principal, async (transaction): Promise<StoredPackageOption[]> => {
    const packages = await transaction.tenderPackage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        canonicalSnapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { document: { select: { originalFileName: true } } },
        },
        _count: { select: { documents: true, participants: true } },
      },
    });
    return packages.map((item) => ({
      id: item.sourceId,
      name: item.canonicalSnapshots[0]?.document.originalFileName ?? item.name,
      context: item.name,
      records: `${item._count.documents} documents · ${item._count.participants} vendors`,
    }));
  });
}
