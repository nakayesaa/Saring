import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { GeneralEngineResult } from "@/lib/analysis/contracts";
import { recordAuditEvent } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { contentHash } from "@/lib/price-engine/adapter";

const findingModule = {
  PRICE: "PRICE",
  DOCUMENT: "DOCUMENT",
  GRAPH: "GRAPH",
  TECHNICAL: "DATA_QUALITY",
  COMPLETENESS: "DATA_QUALITY",
  DATA_QUALITY: "DATA_QUALITY",
  FUSION: "FUSION",
} as const;

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type EngineResultJobIdentity = {
  id: string;
  runId: string;
  organizationId: string;
  packageId: string;
  requestedEngines: string[];
  canonicalSnapshotHash: string;
  package: { sourceId: string; analysisCutoffAt: Date };
};

export function assertEngineResultIdentity(
  job: EngineResultJobIdentity,
  result: GeneralEngineResult,
) {
  if (
    result.run_id !== job.runId ||
    result.package_id !== job.package.sourceId ||
    result.input_snapshot_hash !== job.canonicalSnapshotHash ||
    Date.parse(result.analysis_cutoff_at) !== job.package.analysisCutoffAt.getTime()
  ) {
    throw new DomainError("ENGINE_RESULT_MISMATCH", "Engine result identity does not match the job snapshot.", 422);
  }
  if (!job.requestedEngines.includes(result.engine)) {
    throw new DomainError("UNREQUESTED_ENGINE_RESULT", "The job did not request this engine result.", 422);
  }
}

export async function persistEngineResult(
  transaction: Prisma.TransactionClient,
  job: EngineResultJobIdentity,
  result: GeneralEngineResult,
  actorUserId: string | null,
) {
  assertEngineResultIdentity(job, result);
  const payloadHash = contentHash(result);
  const existing = await transaction.engineResult.findUnique({
    where: { jobId_engine: { jobId: job.id, engine: result.engine } },
    select: { payloadHash: true },
  });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new DomainError("ENGINE_RESULT_CONFLICT", "A different result already exists for this engine.", 409);
    }
    return { accepted: false, duplicate: true } as const;
  }

  const engineResult = await transaction.engineResult.create({
    data: {
      jobId: job.id,
      packageId: job.packageId,
      externalResultId: result.result_id,
      runId: result.run_id,
      engine: result.engine,
      status: result.status,
      score: result.score,
      confidence: result.confidence,
      engineVersion: result.engine_version,
      modelVersion: result.model_version,
      inputSnapshotHash: result.input_snapshot_hash,
      payloadHash,
      payload: jsonValue(result),
    },
  });
  const locators = new Map(result.evidence_locators.map((locator) => [locator.locator_id, locator]));
  if (result.findings.length) {
    await transaction.finding.createMany({
      data: result.findings.map((finding) => ({
        packageId: job.packageId,
        engineResultId: engineResult.id,
        externalFindingId: finding.finding_id,
        type: finding.finding_type,
        module: findingModule[result.engine],
        moduleVersion: result.engine_version,
        status: "OPEN" as const,
        score: finding.score,
        confidence: finding.confidence,
        featureSnapshotHash: result.input_snapshot_hash,
        sourceCitations: jsonValue(
          finding.evidence_locator_ids.flatMap((id) => locators.get(id) ?? []),
        ),
        alternativeExplanations: finding.alternative_explanations,
      })),
    });
  }
  await recordAuditEvent(transaction, {
    organizationId: job.organizationId,
    actorUserId: actorUserId ?? undefined,
    packageId: job.packageId,
    action: "ENGINE_RESULT_RECORDED",
    targetType: "EngineResult",
    targetId: engineResult.id,
    metadata: { engine: result.engine, status: result.status, payloadHash },
  });
  return { accepted: true, duplicate: false } as const;
}
