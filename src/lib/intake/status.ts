import "server-only";

import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { withTenantContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/errors";

export async function getLatestIngestionJob(principal: WorkspacePrincipal, packageSourceId: string) {
  const job = await withTenantContext(principal, (transaction) =>
    transaction.ingestionJob.findFirst({
      where: {
        organizationId: principal.organizationId,
        package: { sourceId: packageSourceId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        package: { select: { sourceId: true, name: true, analysisCutoffAt: true } },
        sourceDocument: { select: { originalFileName: true, byteSize: true, metadata: true } },
      },
    }),
  );
  if (!job) throw new DomainError("INGESTION_JOB_NOT_FOUND", "Ingestion job not found.", 404);
  return {
    jobId: job.id,
    runId: job.runId,
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    packageId: job.package.sourceId,
    packageName: job.package.name,
    analysisCutoffAt: job.package.analysisCutoffAt.toISOString(),
    fileName: job.sourceDocument.originalFileName,
    byteSize: Number(job.sourceDocument.byteSize),
    metadata: job.sourceDocument.metadata,
  };
}
