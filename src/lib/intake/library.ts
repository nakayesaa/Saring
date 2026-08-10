import "server-only";

import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { withTenantContext } from "@/lib/db/tenant";

export type StoredPackageOption = {
  id: string;
  databaseId: string;
  sourceId: string;
  name: string;
  context: string;
  records: string;
  buyer: string;
  method: string;
  stage: string;
  synthetic: boolean;
  documentCount: number;
  participantCount: number;
  findingCount: number;
  updatedAt: string;
};

export function listStoredPackages(principal: WorkspacePrincipal) {
  return withTenantContext(principal, async (transaction): Promise<StoredPackageOption[]> => {
    const packages = await transaction.tenderPackage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { documents: true, participants: true, findings: true } } },
    });
    return packages.map((item) => ({
      id: item.sourceId,
      databaseId: item.id,
      sourceId: item.sourceId,
      name: item.name,
      context: item.name,
      records: `${item._count.documents} documents · ${item._count.participants} vendors`,
      buyer: item.buyerInstitution,
      method: item.procurementMethod,
      stage: item.workflowStage,
      synthetic: item.isSynthetic,
      documentCount: item._count.documents,
      participantCount: item._count.participants,
      findingCount: item._count.findings,
      updatedAt: item.updatedAt.toISOString(),
    }));
  });
}
