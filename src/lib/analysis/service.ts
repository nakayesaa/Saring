import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { recordAuditEvent } from "@/lib/audit";
import type {
  AnalysisJobContract,
} from "@/lib/analysis/contracts";
import { requestedAnalysisEngines } from "@/lib/analysis/contracts";
import { getAnalysisEngineGateway } from "@/lib/analysis/gateway";
import type { AnalysisEngine, AnalysisProgressEvent } from "@/lib/analysis-progress";
import { withTenantContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/errors";
import { contentHash } from "@/lib/price-engine/adapter";
import {
  parseAnalysisJob,
  parseAnalysisProgressEvent,
  parseEngineResult,
} from "@/lib/price-engine/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AnalysisActor = Pick<
  WorkspacePrincipal,
  "authUserId" | "organizationId" | "profileId"
>;

const PIPELINE_VERSION = "saring-analysis-pipeline-1.0.0";
const ANALYSIS_RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_ANALYSIS_JOBS_PER_WINDOW = 10;

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeJob(job: {
  id: string;
  runId: string;
  organizationId: string;
  status: AnalysisJobContract["status"];
  stage: AnalysisJobContract["stage"];
  requestedEngines: AnalysisEngine[];
  canonicalSnapshotHash: string;
  canonicalSnapshotLocation: string;
  inputContractVersion: string;
  outputContractVersion: string;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  lease: Prisma.JsonValue | null;
  error: Prisma.JsonValue | null;
  createdAt: Date;
  availableAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  package: { sourceId: string };
}) {
  return parseAnalysisJob({
    schema_version: "saring-analysis-job-1.0.0",
    job_id: job.id,
    run_id: job.runId,
    organization_id: job.organizationId,
    package_id: job.package.sourceId,
    job_kind: "ANALYSIS",
    status: job.status,
    stage: job.stage,
    requested_engines: job.requestedEngines,
    canonical_snapshot_hash: job.canonicalSnapshotHash,
    canonical_snapshot_location: job.canonicalSnapshotLocation,
    input_contract_version: job.inputContractVersion,
    output_contract_version: job.outputContractVersion,
    idempotency_key: job.idempotencyKey,
    attempt: job.attempt,
    max_attempts: job.maxAttempts,
    lease: job.lease,
    error: job.error,
    created_at: job.createdAt.toISOString(),
    available_at: job.availableAt.toISOString(),
    started_at: job.startedAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
  });
}

const jobInclude = {
  package: { select: { sourceId: true } },
} as const;

export async function createAnalysisJob(
  principal: WorkspacePrincipal,
  packageSourceId: string,
  requestedEngines: readonly AnalysisEngine[] = requestedAnalysisEngines,
) {
  const engines = [...new Set(requestedEngines)].sort() as AnalysisEngine[];
  if (!engines.length || engines.some((engine) => !requestedAnalysisEngines.includes(engine as typeof requestedAnalysisEngines[number]))) {
    throw new DomainError("INVALID_ENGINE_SET", "The requested analysis engines are invalid.", 422);
  }

  return withTenantContext(principal, async (transaction) => {
    const procurementPackage = await transaction.tenderPackage.findUnique({
      where: {
        organizationId_sourceId: {
          organizationId: principal.organizationId,
          sourceId: packageSourceId,
        },
      },
      include: {
        canonicalSnapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { document: true },
        },
      },
    });
    if (!procurementPackage) throw new DomainError("PACKAGE_NOT_FOUND", "Package not found.", 404);
    const canonicalSnapshot = procurementPackage.canonicalSnapshots[0];
    if (!canonicalSnapshot) {
      throw new DomainError("PACKAGE_NOT_READY", "Package intake has not produced a validated snapshot.", 409);
    }
    const canonicalDocument = canonicalSnapshot.document;
    const canonicalSnapshotHash = canonicalSnapshot.snapshotHash;
    const idempotencyKey = contentHash({
      packageId: procurementPackage.id,
      canonicalSnapshotHash,
      engines,
      pipelineVersion: PIPELINE_VERSION,
    });
    const existing = await transaction.analysisJob.findFirst({
      where: {
        organizationId: principal.organizationId,
        packageId: procurementPackage.id,
        canonicalSnapshotHash,
        pipelineVersion: PIPELINE_VERSION,
        requestedEngines: { equals: engines },
      },
      orderBy: { createdAt: "desc" },
      include: jobInclude,
    });
    if (existing && existing.status !== "FAILED") {
      return { job: serializeJob(existing), created: false };
    }
    if (existing && existing.attempt >= existing.maxAttempts) {
      return { job: serializeJob(existing), created: false };
    }

    const recentJobCount = await transaction.analysisJob.count({
      where: {
        requestedById: principal.profileId,
        createdAt: { gte: new Date(Date.now() - ANALYSIS_RATE_WINDOW_MS) },
      },
    });
    if (recentJobCount >= MAX_ANALYSIS_JOBS_PER_WINDOW) {
      throw new DomainError(
        "ANALYSIS_RATE_LIMITED",
        "Too many analysis jobs were requested. Try again later.",
        429,
      );
    }

    const jobId = randomUUID();
    const runId = `AR:${randomUUID()}`;
    const nextAttempt = existing?.attempt ?? 0;
    const jobIdempotencyKey = existing
      ? contentHash({ idempotencyKey, attempt: nextAttempt + 1 })
      : idempotencyKey;
    const now = new Date();
    const queuedEvent = parseAnalysisProgressEvent({
      schema_version: "saring-analysis-progress-event-1.0.0",
      event_id: `EVT:${runId}:0`,
      sequence: 0,
      job_id: jobId,
      run_id: runId,
      package_id: procurementPackage.sourceId,
      engine: null,
      event_type: "RUN_QUEUED",
      stage: "QUEUED",
      status: "QUEUED",
      completed_units: null,
      total_units: null,
      unit_label: null,
      message: "Analysis job queued.",
      finding_count: null,
      occurred_at: now.toISOString(),
    });
    const job = await transaction.analysisJob.upsert({
      where: {
        organizationId_idempotencyKey: {
          organizationId: principal.organizationId,
          idempotencyKey: jobIdempotencyKey,
        },
      },
      update: {},
      create: {
        id: jobId,
        organizationId: principal.organizationId,
        packageId: procurementPackage.id,
        canonicalDocumentId: canonicalDocument.id,
        canonicalSnapshotId: canonicalSnapshot.id,
        retryOfId: existing?.id,
        requestedById: principal.profileId,
        runId,
        requestedEngines: engines,
        canonicalSnapshotHash,
        canonicalSnapshotLocation: `supabase://evidence/${canonicalDocument.storageKey}`,
        inputContractVersion: "saring-canonical-package-1.0.0",
        outputContractVersion: "saring-engine-result-1.0.0",
        pipelineVersion: PIPELINE_VERSION,
        idempotencyKey: jobIdempotencyKey,
        attempt: nextAttempt,
        availableAt: now,
        progressEvents: {
          create: {
            externalEventId: queuedEvent.event_id,
            sequence: queuedEvent.sequence,
            engine: queuedEvent.engine,
            eventType: queuedEvent.event_type,
            stage: queuedEvent.stage,
            status: queuedEvent.status,
            completedUnits: queuedEvent.completed_units,
            totalUnits: queuedEvent.total_units,
            unitLabel: queuedEvent.unit_label,
            message: queuedEvent.message,
            findingCount: queuedEvent.finding_count,
            payload: jsonValue(queuedEvent),
            occurredAt: new Date(queuedEvent.occurred_at),
          },
        },
      },
      include: jobInclude,
    });
    if (job.id !== jobId) return { job: serializeJob(job), created: false };
    await transaction.tenderPackage.update({
      where: { id: procurementPackage.id },
      data: { workflowStage: "IN_REVIEW" },
    });
    await recordAuditEvent(transaction, {
      organizationId: principal.organizationId,
      actorUserId: principal.profileId,
      packageId: procurementPackage.id,
      action: "ANALYSIS_JOB_CREATED",
      targetType: "AnalysisJob",
      targetId: job.id,
      metadata: {
        runId,
        requestedEngines: engines,
        canonicalSnapshotHash,
        retryOfJobId: existing?.id ?? null,
        attempt: nextAttempt + 1,
      },
    });
    return { job: serializeJob(job), created: true };
  });
}

function jobStateFor(event: AnalysisProgressEvent) {
  if (event.event_type === "RUN_STARTED") {
    return { status: "RUNNING" as const, stage: "VALIDATING_SNAPSHOT" as const, startedAt: new Date(event.occurred_at) };
  }
  if (event.event_type === "FUSION_STARTED") return { stage: "FUSING_EVIDENCE" as const };
  if (event.stage === "VALIDATING_RESULTS") return { stage: "VALIDATING_RESULTS" as const };
  if (event.event_type === "RUN_COMPLETED") {
    return { status: "COMPLETED" as const, stage: "COMPLETE" as const, completedAt: new Date(event.occurred_at) };
  }
  if (event.event_type === "RUN_FAILED") {
    return {
      status: "FAILED" as const,
      stage: "COMPLETE" as const,
      completedAt: new Date(event.occurred_at),
      error: { code: "ENGINE_RUN_FAILED", message: event.message, retryable: true },
    };
  }
  if (event.engine) return { stage: "RUNNING_ENGINES" as const };
  return {};
}

export async function recordAnalysisProgress(
  actor: AnalysisActor,
  jobId: string,
  input: unknown,
) {
  const event = parseAnalysisProgressEvent(input);
  if (event.job_id !== jobId) {
    throw new DomainError("JOB_EVENT_MISMATCH", "Progress event belongs to another job.", 422);
  }
  return withTenantContext(actor, async (transaction) => {
    const job = await transaction.analysisJob.findFirst({
      where: { id: jobId, organizationId: actor.organizationId },
      include: jobInclude,
    });
    if (!job) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
    if (event.run_id !== job.runId || event.package_id !== job.package.sourceId) {
      throw new DomainError("JOB_EVENT_MISMATCH", "Progress event identity does not match the job.", 422);
    }
    const duplicate = await transaction.analysisProgressEvent.findFirst({
      where: { jobId, OR: [{ externalEventId: event.event_id }, { sequence: event.sequence }] },
      select: { externalEventId: true },
    });
    if (duplicate) return { accepted: false, duplicate: true };
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      throw new DomainError("JOB_ALREADY_TERMINAL", "The analysis job is already terminal.", 409);
    }
    if (event.event_type === "RUN_COMPLETED") {
      const resultCount = await transaction.engineResult.count({ where: { jobId } });
      if (resultCount !== job.requestedEngines.length) {
        throw new DomainError(
          "ENGINE_RESULTS_INCOMPLETE",
          "Every requested engine must return a validated result before completion.",
          409,
        );
      }
    }
    const latest = await transaction.analysisProgressEvent.aggregate({ where: { jobId }, _max: { sequence: true } });
    if (event.sequence !== (latest._max.sequence ?? -1) + 1) {
      throw new DomainError("EVENT_SEQUENCE_CONFLICT", "Progress events must arrive in sequence.", 409);
    }
    await transaction.analysisProgressEvent.create({
      data: {
        jobId,
        externalEventId: event.event_id,
        sequence: event.sequence,
        engine: event.engine,
        eventType: event.event_type,
        stage: event.stage,
        status: event.status,
        completedUnits: event.completed_units,
        totalUnits: event.total_units,
        unitLabel: event.unit_label,
        message: event.message,
        findingCount: event.finding_count,
        payload: jsonValue(event),
        occurredAt: new Date(event.occurred_at),
      },
    });
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: {
        ...jobStateFor(event),
      },
    });
    return { accepted: true, duplicate: false };
  });
}

const findingModule = {
  PRICE: "PRICE",
  DOCUMENT: "DOCUMENT",
  GRAPH: "GRAPH",
  TECHNICAL: "DATA_QUALITY",
  COMPLETENESS: "DATA_QUALITY",
  DATA_QUALITY: "DATA_QUALITY",
  FUSION: "FUSION",
} as const;

export async function recordEngineResult(
  actor: AnalysisActor,
  jobId: string,
  input: unknown,
) {
  const result = parseEngineResult(input);
  return withTenantContext(actor, async (transaction) => {
    const job = await transaction.analysisJob.findFirst({
      where: { id: jobId, organizationId: actor.organizationId },
      include: { package: { select: { sourceId: true, analysisCutoffAt: true } } },
    });
    if (!job) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
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
    const payloadHash = contentHash(result);
    const existing = await transaction.engineResult.findUnique({
      where: { jobId_engine: { jobId, engine: result.engine } },
      select: { payloadHash: true },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new DomainError("ENGINE_RESULT_CONFLICT", "A different result already exists for this engine.", 409);
      }
      return { accepted: false, duplicate: true };
    }

    const engineResult = await transaction.engineResult.create({
      data: {
        jobId,
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
          status: "OPEN",
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
      organizationId: actor.organizationId,
      actorUserId: actor.profileId,
      packageId: job.packageId,
      action: "ENGINE_RESULT_RECORDED",
      targetType: "EngineResult",
      targetId: engineResult.id,
      metadata: { engine: result.engine, status: result.status, payloadHash },
    });
    return { accepted: true, duplicate: false };
  });
}

export async function dispatchAnalysisJob(actor: AnalysisActor, job: AnalysisJobContract) {
  let elapsed = 0;
  try {
    const dispatch = await withTenantContext(actor, async (transaction) => {
      const claimedAt = new Date();
      const lease = {
        worker_id: "next-dispatch",
        claimed_at: claimedAt.toISOString(),
        heartbeat_at: claimedAt.toISOString(),
        expires_at: new Date(claimedAt.getTime() + 5 * 60 * 1000).toISOString(),
      };
      const claim = await transaction.analysisJob.updateMany({
        where: {
          id: job.job_id,
          organizationId: actor.organizationId,
          status: "QUEUED",
          attempt: { lt: job.max_attempts },
        },
        data: {
          status: "CLAIMED",
          attempt: { increment: 1 },
          lease,
        },
      });
      if (!claim.count) return null;
      const persistedJob = await transaction.analysisJob.findFirst({
        where: { id: job.job_id, organizationId: actor.organizationId },
        include: {
          package: { select: { sourceId: true, analysisCutoffAt: true } },
        },
      });
      if (!persistedJob) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
      return {
        job: serializeJob(persistedJob),
        context: { analysisCutoffAt: persistedJob.package.analysisCutoffAt.toISOString() },
      };
    });
    if (!dispatch) return;
    for await (const message of getAnalysisEngineGateway().dispatch(dispatch.job, dispatch.context)) {
      const waitMs = Math.max(0, message.delayMs - elapsed);
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      elapsed = message.delayMs;
      if (message.kind === "progress") await recordAnalysisProgress(actor, dispatch.job.job_id, message.payload);
      else await recordEngineResult(actor, dispatch.job.job_id, message.payload);
    }
  } catch (error) {
    console.error("Analysis dispatch failed", {
      jobId: job.job_id,
      error: error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error",
    });
    await failAnalysisJob(actor, job.job_id);
  }
}

async function failAnalysisJob(actor: AnalysisActor, jobId: string) {
  return withTenantContext(actor, async (transaction) => {
    const job = await transaction.analysisJob.findFirst({
      where: { id: jobId, organizationId: actor.organizationId },
      include: {
        package: { select: { sourceId: true } },
        progressEvents: { orderBy: { sequence: "desc" }, take: 1 },
      },
    });
    if (!job || ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return;
    const sequence = (job.progressEvents[0]?.sequence ?? -1) + 1;
    const occurredAt = new Date();
    const event = parseAnalysisProgressEvent({
      schema_version: "saring-analysis-progress-event-1.0.0",
      event_id: `EVT:${job.runId}:${sequence}`,
      sequence,
      job_id: job.id,
      run_id: job.runId,
      package_id: job.package.sourceId,
      engine: null,
      event_type: "RUN_FAILED",
      stage: "COMPLETE",
      status: "FAILED",
      completed_units: null,
      total_units: null,
      unit_label: null,
      message: "The analysis service could not complete this run. Retry is safe.",
      finding_count: null,
      occurred_at: occurredAt.toISOString(),
    });
    await transaction.analysisProgressEvent.create({
      data: {
        jobId,
        externalEventId: event.event_id,
        sequence,
        engine: null,
        eventType: event.event_type,
        stage: event.stage,
        status: event.status,
        message: event.message,
        payload: jsonValue(event),
        occurredAt,
      },
    });
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        stage: "COMPLETE",
        completedAt: occurredAt,
        error: { code: "DISPATCH_FAILED", message: event.message, retryable: true },
      },
    });
  });
}

export async function getLatestAnalysisJob(
  principal: WorkspacePrincipal,
  packageSourceId: string,
) {
  return withTenantContext(principal, async (transaction) => {
    const job = await transaction.analysisJob.findFirst({
      where: {
        organizationId: principal.organizationId,
        package: { sourceId: packageSourceId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        package: { select: { sourceId: true, name: true, analysisCutoffAt: true } },
        progressEvents: { orderBy: { sequence: "asc" } },
        results: { select: { engine: true, status: true, score: true, confidence: true } },
      },
    });
    if (!job) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
    return {
      job: serializeJob(job),
      packageName: job.package.name,
      analysisCutoffAt: job.package.analysisCutoffAt.toISOString(),
      events: job.progressEvents.map(({ payload }) => payload as unknown as AnalysisProgressEvent),
      results: job.results.map((result) => ({
        engine: result.engine,
        status: result.status,
        score: result.score === null ? null : Number(result.score),
        confidence: result.confidence === null ? null : Number(result.confidence),
      })),
    };
  });
}

export async function getLatestAnalysisResults(
  principal: WorkspacePrincipal,
  packageSourceId: string,
) {
  return withTenantContext(principal, async (transaction) => {
    const job = await transaction.analysisJob.findFirst({
      where: {
        organizationId: principal.organizationId,
        package: { sourceId: packageSourceId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        package: { select: { sourceId: true, name: true, analysisCutoffAt: true } },
        results: { orderBy: { createdAt: "asc" }, select: { payload: true } },
      },
    });
    if (!job) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
    if (job.status !== "COMPLETED") {
      throw new DomainError("ANALYSIS_NOT_COMPLETE", "Analysis results are not ready yet.", 409);
    }
    return {
      packageId: job.package.sourceId,
      packageName: job.package.name,
      runId: job.runId,
      analysisCutoffAt: job.package.analysisCutoffAt.toISOString(),
      results: job.results.map(({ payload }) => parseEngineResult(payload)),
    };
  });
}

export async function resolveWorkerActor(jobId: string): Promise<AnalysisActor> {
  const admin = createSupabaseAdminClient();
  const { data: job, error: jobError } = await admin
    .from("AnalysisJob")
    .select("organizationId,requestedById")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
  const jobRecord = job as unknown as { organizationId: string; requestedById: string };
  const { data: user, error: userError } = await admin
    .from("UserProfile")
    .select("authUserId")
    .eq("id", jobRecord.requestedById)
    .maybeSingle();
  if (userError || !user) throw new DomainError("JOB_ACTOR_NOT_FOUND", "Analysis job actor not found.", 409);
  const userRecord = user as unknown as { authUserId: string };
  return {
    organizationId: jobRecord.organizationId,
    profileId: jobRecord.requestedById,
    authUserId: userRecord.authUserId,
  };
}
