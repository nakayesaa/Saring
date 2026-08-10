import "server-only";

import { createHash } from "node:crypto";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import graphInputSchema from "../../../contracts/v1/graph-engine-input.schema.json";
import priceInputSchema from "../../../contracts/v1/price-engine-input.schema.json";
import priceObservationSchema from "../../../contracts/v1/price-observation.schema.json";
import priceObservationSnapshotSchema from "../../../contracts/v1/price-observation-snapshot.schema.json";
import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { withTenantContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const REGISTRATION_HOLD_MS = 15 * 60 * 1000;

export const auxiliaryInputKinds = [
  "PRICE_ENGINE_INPUT",
  "PRICE_OBSERVATION_SNAPSHOT",
  "GRAPH_ENGINE_INPUT",
] as const;
export type AuxiliaryInputKind = typeof auxiliaryInputKinds[number];

const contract = {
  PRICE_ENGINE_INPUT: {
    engine: "PRICE",
    schemaVersion: "saring-price-engine-input-1.0.0",
    schemaId: priceInputSchema.$id,
  },
  PRICE_OBSERVATION_SNAPSHOT: {
    engine: "PRICE",
    schemaVersion: "saring-price-observation-snapshot-1.0.0",
    schemaId: priceObservationSnapshotSchema.$id,
  },
  GRAPH_ENGINE_INPUT: {
    engine: "GRAPH",
    schemaVersion: "saring-graph-engine-input-1.0.0",
    schemaId: graphInputSchema.$id,
  },
} as const;

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: true }));
for (const schema of [
  priceObservationSchema,
  priceInputSchema,
  priceObservationSnapshotSchema,
  graphInputSchema,
]) {
  ajv.addSchema(schema);
}

function validationIssues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 12).map((error) =>
    `${error.instancePath || "/"} ${error.message ?? error.keyword}`,
  );
}

function parseInput(kind: AuxiliaryInputKind, payload: unknown) {
  const validate = ajv.getSchema(contract[kind].schemaId);
  if (!validate || !validate(payload)) {
    throw new DomainError(
      "INVALID_AUXILIARY_INPUT",
      `Auxiliary input contract failed: ${validationIssues(validate?.errors).join("; ")}`,
      422,
    );
  }
  return payload as Record<string, unknown>;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotId(kind: AuxiliaryInputKind, payload: Record<string, unknown>) {
  if (kind === "PRICE_OBSERVATION_SNAPSHOT") return String(payload.snapshot_id);
  if (kind === "PRICE_ENGINE_INPUT") return String(payload.comparator_snapshot_id);
  return String(payload.cohort_snapshot_id);
}

export async function registerAnalysisAuxiliaryInputs(
  principal: WorkspacePrincipal,
  jobId: string,
  requested: Array<{ kind: AuxiliaryInputKind; payload: unknown }>,
) {
  const kinds = requested.map(({ kind }) => kind);
  if (new Set(kinds).size !== kinds.length) {
    throw new DomainError("DUPLICATE_AUXILIARY_INPUT", "Input kinds must be unique.", 422);
  }
  const priceKinds = new Set(kinds.filter((kind) => kind.startsWith("PRICE_")));
  if (priceKinds.size === 1) {
    throw new DomainError(
      "INCOMPLETE_PRICE_AUXILIARY_INPUT",
      "Price target input and observation snapshot must be registered together.",
      422,
    );
  }
  const parsed = requested.map(({ kind, payload }) => ({
    kind,
    payload: parseInput(kind, payload),
  }));
  const heldUntil = new Date(Date.now() + REGISTRATION_HOLD_MS);
  const job = await withTenantContext(principal, async (transaction) => {
    const current = await transaction.analysisJob.findFirst({
      where: { id: jobId, organizationId: principal.organizationId },
      include: { package: { select: { sourceId: true, analysisCutoffAt: true } }, auxiliaryInputs: true },
    });
    if (!current) throw new DomainError("JOB_NOT_FOUND", "Analysis job not found.", 404);
    if (current.status !== "QUEUED" || current.attempt !== 0 || current.lease !== null) {
      throw new DomainError(
        "ANALYSIS_JOB_ALREADY_STARTED",
        "Auxiliary inputs can only be registered before the first worker claim.",
        409,
      );
    }
    if (current.auxiliaryInputs.length) {
      throw new DomainError(
        "AUXILIARY_INPUT_ALREADY_REGISTERED",
        "This analysis job already has auxiliary inputs.",
        409,
      );
    }
    await transaction.analysisJob.update({
      where: { id: current.id },
      data: { availableAt: heldUntil },
    });
    return current;
  });

  const uploaded: Array<{
    kind: AuxiliaryInputKind;
    objectKey: string;
    sha256: string;
    bytes: Uint8Array;
    snapshotId: string;
  }> = [];
  try {
    for (const item of parsed) {
      const metadata = contract[item.kind];
      if (!job.requestedEngines.includes(metadata.engine)) {
        throw new DomainError(
          "AUXILIARY_ENGINE_NOT_REQUESTED",
          `${metadata.engine} was not requested by this analysis job.`,
          422,
        );
      }
      if (item.kind !== "PRICE_OBSERVATION_SNAPSHOT") {
        if (
          item.payload.run_id !== job.runId ||
          item.payload.package_id !== job.package.sourceId ||
          item.payload.canonical_input_hash !== job.canonicalSnapshotHash ||
          item.payload.analysis_cutoff !== job.package.analysisCutoffAt.toISOString()
        ) {
          throw new DomainError(
            "AUXILIARY_JOB_IDENTITY_MISMATCH",
            `${item.kind} does not match the target analysis job.`,
            422,
          );
        }
      }
      const body = new TextEncoder().encode(`${stableJson(item.payload)}\n`);
      const sha256 = createHash("sha256").update(body).digest("hex");
      const id = snapshotId(item.kind, item.payload);
      const objectKey = [
        job.organizationId,
        job.packageId,
        "analysis-inputs",
        job.id,
        `${item.kind.toLowerCase()}-${sha256}.json`,
      ].join("/");
      const upload = await createSupabaseAdminClient().storage.from(BUCKET).upload(
        objectKey,
        body,
        { contentType: "application/json", upsert: false },
      );
      if (upload.error) throw new Error(`Unable to upload ${item.kind}.`);
      uploaded.push({ kind: item.kind, objectKey, sha256, bytes: body, snapshotId: id });
    }

    await withTenantContext(principal, async (transaction) => {
      const current = await transaction.analysisJob.findFirst({
        where: { id: job.id, organizationId: principal.organizationId },
      });
      if (!current || current.status !== "QUEUED" || current.attempt !== 0) {
        throw new DomainError(
          "ANALYSIS_JOB_ALREADY_STARTED",
          "Analysis job changed while auxiliary inputs were uploading.",
          409,
        );
      }
      await transaction.analysisAuxiliaryInput.createMany({
        data: uploaded.map((item) => ({
          jobId: job.id,
          kind: item.kind,
          engine: contract[item.kind].engine,
          snapshotId: item.snapshotId,
          objectKey: item.objectKey,
          sha256: item.sha256,
          byteSize: BigInt(item.bytes.byteLength),
          schemaVersion: contract[item.kind].schemaVersion,
        })),
      });
      await transaction.analysisJob.update({
        where: { id: job.id },
        data: { availableAt: new Date() },
      });
    });
  } catch (error) {
    if (uploaded.length) {
      await createSupabaseAdminClient().storage
        .from(BUCKET)
        .remove(uploaded.map(({ objectKey }) => objectKey));
    }
    await withTenantContext(principal, (transaction) =>
      transaction.analysisJob.updateMany({
        where: { id: job.id, organizationId: principal.organizationId, status: "QUEUED", attempt: 0 },
        data: { availableAt: new Date() },
      }),
    );
    throw error;
  }

  return {
    job_id: job.id,
    registered: uploaded.map((item) => ({
      kind: item.kind,
      snapshot_id: item.snapshotId,
      sha256: item.sha256,
      size_bytes: item.bytes.byteLength,
    })),
  };
}
