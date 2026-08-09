import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";

export async function lockAnalysisJob(transaction: Prisma.TransactionClient, jobId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "AnalysisJob" WHERE id = ${jobId}::uuid FOR UPDATE
  `;
  if (!rows[0]) throw new DomainError("ANALYSIS_JOB_NOT_FOUND", "Analysis job not found.", 404);
  const job = await transaction.analysisJob.findUnique({
    where: { id: jobId },
    include: { package: { select: { sourceId: true, analysisCutoffAt: true } } },
  });
  if (!job) throw new DomainError("ANALYSIS_JOB_NOT_FOUND", "Analysis job not found.", 404);
  return job;
}
