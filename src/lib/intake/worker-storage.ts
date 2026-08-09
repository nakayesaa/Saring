import "server-only";

import { createHash } from "node:crypto";
import { DomainError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const ARTIFACT_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const ARTIFACT_DOWNLOAD_TTL_SECONDS = 5 * 60;
const MAX_VERIFIED_ARTIFACT_BYTES = 256 * 1024 * 1024;

export type PreparedArtifactRecord = {
  id: string;
  kind: "PARSER_RESULT" | "CANONICAL_SNAPSHOT";
  objectKey: string;
  sha256: string;
  byteSize: bigint;
  schemaVersion: string;
  mimeType: string;
};

export type VerifiedJsonArtifactRecord = Pick<
  PreparedArtifactRecord,
  "objectKey" | "sha256" | "byteSize" | "schemaVersion" | "mimeType"
>;

export async function issueArtifactUploadTargets(artifacts: PreparedArtifactRecord[]) {
  const expiresAt = new Date(Date.now() + ARTIFACT_UPLOAD_TTL_MS).toISOString();
  return Promise.all(
    artifacts.map(async (artifact) => {
      const { data, error } = await createSupabaseAdminClient()
        .storage.from(BUCKET)
        .createSignedUploadUrl(artifact.objectKey, { upsert: true });
      if (error || !data) {
        throw new DomainError("ARTIFACT_STORAGE_UNAVAILABLE", "Unable to prepare artifact upload.", 503);
      }
      return {
        artifact_id: artifact.id,
        kind: artifact.kind,
        object_key: artifact.objectKey,
        sha256: artifact.sha256,
        size_bytes: Number(artifact.byteSize),
        schema_version: artifact.schemaVersion,
        media_type: artifact.mimeType,
        upload: {
          url: data.signedUrl,
          method: "PUT" as const,
          headers: {
            "content-type": artifact.mimeType,
            "cache-control": "max-age=3600",
          },
          expires_at: expiresAt,
        },
      };
    }),
  );
}

export async function downloadVerifiedJsonArtifact(artifact: VerifiedJsonArtifactRecord) {
  const expectedBytes = Number(artifact.byteSize);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes > MAX_VERIFIED_ARTIFACT_BYTES) {
    throw new DomainError("ARTIFACT_TOO_LARGE", "Artifact exceeds the verification limit.", 422);
  }
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(artifact.objectKey, ARTIFACT_DOWNLOAD_TTL_SECONDS);
  if (error || !data) {
    throw new DomainError("ARTIFACT_NOT_FOUND", "Prepared artifact could not be opened.", 409);
  }

  const response = await fetch(data.signedUrl, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new DomainError("ARTIFACT_NOT_FOUND", "Prepared artifact upload is missing.", 409);
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new DomainError("ARTIFACT_MEDIA_TYPE_MISMATCH", "Artifact media type is invalid.", 422);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? expectedBytes);
  if (Number.isFinite(declaredLength) && declaredLength !== expectedBytes) {
    throw new DomainError("ARTIFACT_SIZE_MISMATCH", "Artifact size does not match its declaration.", 422);
  }

  const chunks: Buffer[] = [];
  const digest = createHash("sha256");
  const reader = response.body.getReader();
  let observedBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    observedBytes += value.byteLength;
    if (observedBytes > expectedBytes || observedBytes > MAX_VERIFIED_ARTIFACT_BYTES) {
      await reader.cancel();
      throw new DomainError("ARTIFACT_SIZE_MISMATCH", "Artifact exceeds its declared size.", 422);
    }
    const chunk = Buffer.from(value);
    digest.update(chunk);
    chunks.push(chunk);
  }
  if (observedBytes !== expectedBytes) {
    throw new DomainError("ARTIFACT_SIZE_MISMATCH", "Artifact size does not match its declaration.", 422);
  }
  if (digest.digest("hex") !== artifact.sha256) {
    throw new DomainError("ARTIFACT_HASH_MISMATCH", "Artifact hash verification failed.", 422);
  }

  try {
    return JSON.parse(Buffer.concat(chunks, observedBytes).toString("utf8")) as unknown;
  } catch {
    throw new DomainError("ARTIFACT_JSON_INVALID", "Artifact does not contain valid JSON.", 422);
  }
}
