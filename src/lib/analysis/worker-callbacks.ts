import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type AnalysisEventStatus } from "@/generated/prisma/client";
import { persistEngineResult } from "@/lib/analysis/results";
import {
  ANALYSIS_ARTIFACT_PREPARE_CONTRACT,
  ANALYSIS_RESULT_CALLBACK_CONTRACT,
  ANALYSIS_WORKER_PROGRESS_CONTRACT,
  type AnalysisArtifactDescriptor,
  type AnalysisResultCallback,
  type AnalysisWorkerProgress,
  parseAnalysisArtifactPrepare,
  parseAnalysisResultCallback,
  parseAnalysisWorkerProgress,
  parseEngineResultV2,
  validateAnalysisArtifactResponse,
  validateAnalysisProgressAck,
  validateAnalysisResultAck,
} from "@/lib/analysis/worker-contracts";
import { lockAnalysisJob } from "@/lib/analysis/worker-lease";
import {
  issueAnalysisArtifactUploadTargets,
  type PreparedAnalysisArtifact,
} from "@/lib/analysis/worker-storage";
import { recordAuditEvent } from "@/lib/audit";
import { getPrismaClient } from "@/lib/db/client";
import { DomainError } from "@/lib/errors";
import {
  assertActiveLease,
  hashPayload,
  renewLease,
  RESULT_VERIFICATION_LEASE_MS,
} from "@/lib/intake/worker-lease";
import { downloadVerifiedJsonArtifact } from "@/lib/intake/worker-storage";

const TERMINAL_STATUSES = ["COMPLETED", "NEEDS_REVIEW", "ABSTAINED", "FAILED"];
const STAGE_ORDER: Record<string, number> = {
  QUEUED: -1,
  VALIDATING_SNAPSHOT: 0,
  PREPARING_ENGINES: 1,
  RUNNING_ENGINES: 2,
  RUNNING_PRICE_ENGINE: 2,
  RUNNING_DOCUMENT_ENGINE: 2,
  RUNNING_GRAPH_ENGINE: 2,
  RUNNING_TECHNICAL_CHECK: 2,
  RUNNING_COMPLETENESS_CHECK: 2,
  RUNNING_DATA_QUALITY_CHECK: 2,
  FUSING_EVIDENCE: 3,
  VALIDATING_RESULTS: 4,
  UPLOADING_RESULTS: 5,
  COMPLETE: 6,
};
const STAGE_ENGINE: Partial<Record<AnalysisWorkerProgress["stage"], AnalysisWorkerProgress["engine"]>> = {
  RUNNING_PRICE_ENGINE: "PRICE",
  RUNNING_DOCUMENT_ENGINE: "DOCUMENT",
  RUNNING_GRAPH_ENGINE: "GRAPH",
  RUNNING_TECHNICAL_CHECK: "TECHNICAL",
  RUNNING_COMPLETENESS_CHECK: "COMPLETENESS",
  RUNNING_DATA_QUALITY_CHECK: "DATA_QUALITY",
};

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function progressAck(eventId: string, leaseExpiresAt: string) {
  return validateAnalysisProgressAck({
    schema_version: ANALYSIS_WORKER_PROGRESS_CONTRACT,
    event_id: eventId,
    accepted: true,
    lease_expires_at: leaseExpiresAt,
  });
}

function resultAck(callbackId: string, status: AnalysisResultCallback["status"]) {
  return validateAnalysisResultAck({
    schema_version: ANALYSIS_RESULT_CALLBACK_CONTRACT,
    callback_id: callbackId,
    accepted: true,
    status,
  });
}

function publicStage(stage: AnalysisWorkerProgress["stage"]) {
  return {
    VALIDATING_SNAPSHOT: "SNAPSHOT_VALIDATION",
    PREPARING_ENGINES: "SNAPSHOT_VALIDATION",
    RUNNING_PRICE_ENGINE: "ESTIMATING_PRICE_RANGE",
    RUNNING_DOCUMENT_ENGINE: "COMPARING_PASSAGES",
    RUNNING_GRAPH_ENGINE: "EVALUATING_GRAPH_MOTIFS",
    RUNNING_TECHNICAL_CHECK: "TECHNICAL_MATCHING",
    RUNNING_COMPLETENESS_CHECK: "CHECKING_DOCUMENT_COMPLETENESS",
    RUNNING_DATA_QUALITY_CHECK: "CHECKING_DATA_QUALITY",
    FUSING_EVIDENCE: "FUSING_EVIDENCE",
    VALIDATING_RESULTS: "VALIDATING_RESULTS",
    UPLOADING_RESULTS: "VALIDATING_RESULTS",
  }[stage];
}

function persistedStage(stage: AnalysisWorkerProgress["stage"]) {
  if (stage === "VALIDATING_SNAPSHOT") return "VALIDATING_SNAPSHOT" as const;
  if (stage === "PREPARING_ENGINES") return "PREPARING_ENGINES" as const;
  if (stage === "FUSING_EVIDENCE") return "FUSING_EVIDENCE" as const;
  if (stage === "VALIDATING_RESULTS") return "VALIDATING_RESULTS" as const;
  if (stage === "UPLOADING_RESULTS") return "UPLOADING_RESULTS" as const;
  return "RUNNING_ENGINES" as const;
}

function publicEvent(event: AnalysisWorkerProgress, packageId: string) {
  const eventType = event.event_type === "HEARTBEAT" ? "PROGRESS" :
    event.event_type === "STAGE_STARTED" ? "STAGE_STARTED" : event.event_type;
  const status: AnalysisEventStatus = event.event_type === "ENGINE_COMPLETED" ? "COMPLETED" :
    event.event_type === "ENGINE_ABSTAINED" ? "ABSTAINED" :
      event.event_type === "ENGINE_FAILED" ? "FAILED" : "RUNNING";
  return {
    schema_version: "saring-analysis-progress-event-1.0.0" as const,
    event_id: event.event_id,
    sequence: event.sequence,
    job_id: event.job_id,
    run_id: event.run_id,
    package_id: packageId,
    engine: event.engine,
    event_type: eventType,
    stage: publicStage(event.stage),
    status,
    completed_units: event.completed_units,
    total_units: event.total_units,
    unit_label: event.unit_label,
    message: event.message ?? (event.event_type === "HEARTBEAT" ? "Analysis worker heartbeat." : "Analysis stage updated."),
    finding_count: event.finding_count,
    occurred_at: event.occurred_at,
  };
}

export async function recordAnalysisWorkerProgress(jobId: string, value: unknown) {
  const event = parseAnalysisWorkerProgress(value);
  if (event.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }
  if (
    event.completed_units !== null && event.total_units !== null &&
    event.completed_units > event.total_units
  ) {
    throw new DomainError("INVALID_PROGRESS_COUNT", "Completed units cannot exceed total units.", 422);
  }
  const stageEngine = STAGE_ENGINE[event.stage];
  if (stageEngine && event.engine !== stageEngine) {
    throw new DomainError("PROGRESS_ENGINE_STAGE_MISMATCH", "Progress engine does not match its stage.", 422);
  }

  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockAnalysisJob(transaction, jobId);
    assertActiveLease(job, event, now);
    if (event.engine && !job.requestedEngines.includes(event.engine)) {
      throw new DomainError("UNREQUESTED_ENGINE_PROGRESS", "Progress names an engine that was not requested.", 422);
    }
    const lease = renewLease(job, now);
    const payload = publicEvent(event, job.package.sourceId);
    const payloadHash = hashPayload(payload);
    const duplicate = await transaction.analysisProgressEvent.findFirst({
      where: { jobId, OR: [{ externalEventId: event.event_id }, { sequence: event.sequence }] },
    });
    if (duplicate) {
      if (duplicate.externalEventId !== event.event_id || hashPayload(duplicate.payload) !== payloadHash) {
        throw new DomainError("EVENT_ID_CONFLICT", "Progress event ID was reused with different content.", 409);
      }
      await transaction.analysisJob.update({ where: { id: jobId }, data: { lease } });
      return progressAck(event.event_id, lease.expires_at);
    }
    if (event.sequence !== job.lastProgressSequence + 1) {
      throw new DomainError("PROGRESS_SEQUENCE_CONFLICT", "Progress events must arrive in sequence.", 409);
    }
    if ((STAGE_ORDER[event.stage] ?? -1) < (STAGE_ORDER[job.stage] ?? -1)) {
      throw new DomainError("PROGRESS_STAGE_REGRESSION", "Progress cannot move to an earlier stage.", 409);
    }

    await transaction.analysisProgressEvent.create({
      data: {
        jobId,
        externalEventId: event.event_id,
        sequence: event.sequence,
        engine: event.engine,
        eventType: payload.event_type,
        stage: payload.stage,
        status: payload.status,
        completedUnits: event.completed_units,
        totalUnits: event.total_units,
        unitLabel: event.unit_label,
        message: payload.message,
        findingCount: event.finding_count,
        payload: jsonValue(payload),
        occurredAt: new Date(event.occurred_at),
      },
    });
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        stage: persistedStage(event.stage),
        lease,
        lastProgressSequence: event.sequence,
      },
    });
    return progressAck(event.event_id, lease.expires_at);
  });
}

function artifactMatches(record: PreparedAnalysisArtifact, descriptor: AnalysisArtifactDescriptor) {
  return record.engine === descriptor.engine &&
    record.sha256 === descriptor.sha256 &&
    Number(record.byteSize) === descriptor.size_bytes &&
    record.schemaVersion === descriptor.schema_version &&
    record.mimeType === descriptor.media_type;
}

function assertUniqueEngineSet(engines: string[], expected: string[]) {
  const actual = [...new Set(engines)].sort();
  const required = [...new Set(expected)].sort();
  if (actual.length !== engines.length || actual.join("|") !== required.join("|")) {
    throw new DomainError("ARTIFACT_ENGINE_SET_MISMATCH", "Analysis artifacts must match the requested engine set.", 409);
  }
}

export async function prepareAnalysisArtifacts(jobId: string, value: unknown) {
  const request = parseAnalysisArtifactPrepare(value);
  if (request.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }

  const prepared = await getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockAnalysisJob(transaction, jobId);
    assertActiveLease(job, request, now);
    assertUniqueEngineSet(request.artifacts.map(({ engine }) => engine), job.requestedEngines);
    const existing = await transaction.analysisArtifact.findMany({
      where: { jobId, attempt: job.attempt },
      orderBy: { engine: "asc" },
    });
    let artifacts: PreparedAnalysisArtifact[];
    if (existing.length) {
      if (
        existing.length !== request.artifacts.length ||
        request.artifacts.some((descriptor) => {
          const artifact = existing.find((item) => item.engine === descriptor.engine);
          return !artifact || !artifactMatches(artifact, descriptor);
        })
      ) {
        throw new DomainError("ARTIFACT_PREPARE_CONFLICT", "This attempt already declared a different artifact set.", 409);
      }
      artifacts = existing;
    } else {
      artifacts = [];
      for (const descriptor of request.artifacts) {
        const artifactId = randomUUID();
        artifacts.push(await transaction.analysisArtifact.create({
          data: {
            id: artifactId,
            jobId,
            attempt: job.attempt,
            engine: descriptor.engine,
            objectKey: `${job.organizationId}/derived/${job.packageId}/analysis/${job.id}/attempt-${job.attempt}/${descriptor.engine.toLowerCase()}-result.json`,
            sha256: descriptor.sha256,
            byteSize: BigInt(descriptor.size_bytes),
            schemaVersion: descriptor.schema_version,
            mimeType: descriptor.media_type,
            prepareRequestId: request.request_id,
          },
        }));
      }
    }
    const lease = renewLease(job, now);
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", stage: "UPLOADING_RESULTS", lease },
    });
    return { artifacts, leaseExpiresAt: lease.expires_at };
  });

  return validateAnalysisArtifactResponse({
    schema_version: ANALYSIS_ARTIFACT_PREPARE_CONTRACT,
    request_id: request.request_id,
    job_id: request.job_id,
    run_id: request.run_id,
    lease_expires_at: prepared.leaseExpiresAt,
    artifacts: await issueAnalysisArtifactUploadTargets(prepared.artifacts),
  });
}

function assertArtifactReferences(
  records: PreparedAnalysisArtifact[],
  callback: AnalysisResultCallback,
) {
  if (records.length !== callback.artifacts.length) {
    throw new DomainError("ARTIFACT_SET_MISMATCH", "Result artifacts do not match the prepared set.", 409);
  }
  assertUniqueEngineSet(callback.artifacts.map(({ engine }) => engine), records.map(({ engine }) => engine));
  for (const reference of callback.artifacts) {
    const record = records.find((item) => item.id === reference.artifact_id);
    if (
      !record || record.objectKey !== reference.object_key ||
      !artifactMatches(record, reference)
    ) {
      throw new DomainError("ARTIFACT_REFERENCE_INVALID", "Result contains an invalid artifact reference.", 409);
    }
  }
}

function expectedTerminalStatus(results: ReturnType<typeof parseEngineResultV2>[]) {
  if (results.every(({ status }) => status === "ABSTAINED" || status === "NOT_APPLICABLE")) {
    return "ABSTAINED" as const;
  }
  if (results.some(({ status }) => status === "LOW_CONFIDENCE")) return "NEEDS_REVIEW" as const;
  return "COMPLETED" as const;
}

function assertResultSummary(
  callback: AnalysisResultCallback,
  results: ReturnType<typeof parseEngineResultV2>[],
) {
  const summary = callback.summary;
  if (!summary) throw new DomainError("RESULT_SUMMARY_MISSING", "Analysis summary is required.", 422);
  const counts = {
    engine_count: results.length,
    scored_count: results.filter(({ status }) => status === "SCORED").length,
    low_confidence_count: results.filter(({ status }) => status === "LOW_CONFIDENCE").length,
    abstained_count: results.filter(({ status }) => status === "ABSTAINED").length,
    not_applicable_count: results.filter(({ status }) => status === "NOT_APPLICABLE").length,
    finding_count: results.reduce((total, result) => total + result.findings.length, 0),
  };
  if (Object.entries(counts).some(([key, count]) => summary[key as keyof typeof summary] !== count)) {
    throw new DomainError("RESULT_SUMMARY_MISMATCH", "Analysis result summary counts are inconsistent.", 422);
  }
  if (callback.status !== expectedTerminalStatus(results)) {
    throw new DomainError("RESULT_STATUS_MISMATCH", "Terminal status does not match the engine results.", 422);
  }
}

function terminalEvent(job: Awaited<ReturnType<typeof lockAnalysisJob>>, failed: boolean, now: Date) {
  const sequence = job.lastProgressSequence + 1;
  return {
    schema_version: "saring-analysis-progress-event-1.0.0" as const,
    event_id: `EVT:${job.runId}:${sequence}`,
    sequence,
    job_id: job.id,
    run_id: job.runId,
    package_id: job.package.sourceId,
    engine: null,
    event_type: failed ? "RUN_FAILED" as const : "RUN_COMPLETED" as const,
    stage: "COMPLETE",
    status: failed ? "FAILED" as const : "COMPLETED" as const,
    completed_units: null,
    total_units: null,
    unit_label: null,
    message: failed
      ? "The analysis worker stopped safely. Retry follows the declared error policy."
      : "Validated engine results are ready for human review.",
    finding_count: null,
    occurred_at: now.toISOString(),
  };
}

async function persistTerminalEvent(
  transaction: Prisma.TransactionClient,
  job: Awaited<ReturnType<typeof lockAnalysisJob>>,
  failed: boolean,
  now: Date,
) {
  const event = terminalEvent(job, failed, now);
  await transaction.analysisProgressEvent.create({
    data: {
      jobId: job.id,
      externalEventId: event.event_id,
      sequence: event.sequence,
      engine: null,
      eventType: event.event_type,
      stage: event.stage,
      status: event.status,
      message: event.message,
      payload: jsonValue(event),
      occurredAt: now,
    },
  });
  return event.sequence;
}

async function recordFailedAnalysisResult(jobId: string, callback: AnalysisResultCallback) {
  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockAnalysisJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, { permitExpired: true, permittedStatuses: TERMINAL_STATUSES });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return resultAck(callback.callback_id, callback.status);
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    const sequence = await persistTerminalEvent(transaction, job, true, now);
    await transaction.analysisArtifact.updateMany({
      where: { jobId, attempt: job.attempt, status: "PREPARED" },
      data: { status: "REJECTED" },
    });
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        stage: "COMPLETE",
        resultCallbackId: callback.callback_id,
        lastProgressSequence: sequence,
        completedAt: now,
        error: jsonValue(callback.error),
      },
    });
    await recordAuditEvent(transaction, {
      organizationId: job.organizationId,
      actorUserId: job.requestedById,
      packageId: job.packageId,
      action: "ANALYSIS_JOB_FAILED",
      targetType: "AnalysisJob",
      targetId: job.id,
      metadata: jsonValue({ code: callback.error?.code, retryable: callback.error?.retryable }),
    });
    return resultAck(callback.callback_id, callback.status);
  });
}

export async function recordAnalysisResult(jobId: string, value: unknown) {
  const callback = parseAnalysisResultCallback(value);
  if (callback.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }
  if (callback.status === "FAILED") return recordFailedAnalysisResult(jobId, callback);

  const context = await getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockAnalysisJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, { permitExpired: true, permittedStatuses: TERMINAL_STATUSES });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return { duplicate: true as const, job, artifacts: [] };
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    const artifacts = await transaction.analysisArtifact.findMany({
      where: { jobId, attempt: job.attempt, status: "PREPARED" },
    });
    assertArtifactReferences(artifacts, callback);
    const lease = renewLease(job, now, RESULT_VERIFICATION_LEASE_MS);
    await transaction.analysisJob.update({ where: { id: jobId }, data: { lease } });
    return { duplicate: false as const, job: { ...job, lease }, artifacts };
  });
  if (context.duplicate) return resultAck(callback.callback_id, callback.status);

  const results: Array<ReturnType<typeof parseEngineResultV2>> = [];
  for (const artifact of context.artifacts) {
    const result = parseEngineResultV2(await downloadVerifiedJsonArtifact(artifact));
    if (result.engine !== artifact.engine) {
      throw new DomainError("ARTIFACT_ENGINE_MISMATCH", "Artifact engine identity is invalid.", 422);
    }
    results.push(result);
  }
  assertUniqueEngineSet(results.map(({ engine }) => engine), context.job.requestedEngines);
  assertResultSummary(callback, results);

  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockAnalysisJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, { permitExpired: true, permittedStatuses: TERMINAL_STATUSES });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return resultAck(callback.callback_id, callback.status);
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    const artifacts = await transaction.analysisArtifact.findMany({
      where: { jobId, attempt: job.attempt, status: "PREPARED" },
    });
    assertArtifactReferences(artifacts, callback);

    for (const result of results) {
      await persistEngineResult(transaction, job, result, job.requestedById);
    }
    const sequence = await persistTerminalEvent(transaction, job, false, now);
    await transaction.analysisArtifact.updateMany({
      where: { jobId, attempt: job.attempt },
      data: { status: "VERIFIED", verifiedAt: now },
    });
    await transaction.analysisJob.update({
      where: { id: jobId },
      data: {
        status: callback.status,
        stage: "COMPLETE",
        resultCallbackId: callback.callback_id,
        lastProgressSequence: sequence,
        completedAt: now,
        error: Prisma.JsonNull,
      },
    });
    await recordAuditEvent(transaction, {
      organizationId: job.organizationId,
      actorUserId: job.requestedById,
      packageId: job.packageId,
      action: "ANALYSIS_JOB_COMPLETED",
      targetType: "AnalysisJob",
      targetId: job.id,
      metadata: jsonValue({
        status: callback.status,
        engines: results.map(({ engine }) => engine),
        findingCount: callback.summary?.finding_count,
      }),
    });
    return resultAck(callback.callback_id, callback.status);
  });
}
