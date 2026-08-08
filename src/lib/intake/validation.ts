import "server-only";

import { createHash } from "node:crypto";
import { basename, posix } from "node:path";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { DomainError } from "@/lib/errors";
import { contentHash } from "@/lib/price-engine/adapter";
import { parseCanonicalPackage } from "@/lib/price-engine/validation";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_CANONICAL_BYTES = 10 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 500;
const MAX_EXPANDED_BYTES = 250 * 1024 * 1024;
const CANONICAL_NAMES = new Set(["canonical-package.json", "canonical_package.json"]);

export type CanonicalSnapshot = {
  schema_version: "saring-canonical-package-1.0.0";
  package: {
    package_id: string;
    source_id: string;
    name: string;
    fiscal_year: number;
    procurement_method: string;
    category_code: string | null;
    buyer: {
      institution_name: string;
      unit_name: string | null;
    };
    region_code: string | null;
    hps_total: number | null;
    currency: string;
    bid_deadline_at: string;
    analysis_cutoff_at: string;
    bundle_mode: "LIVE_AUTHORIZED" | "RETROSPECTIVE" | "SYNTHETIC";
    participant_count: number;
  };
  items: Array<{
    item_id: string;
    description: string;
    quantity: number;
    unit: string;
    hps_unit_price: number | null;
    specifications: Record<string, string | number | boolean | null>;
  }>;
  requirements: Array<{
    requirement_id: string;
    category: string;
    field: string;
    expected_value: string | number | boolean | null;
    status: string;
  }>;
  participants: Array<{
    participation_id: string;
    vendor: {
      vendor_id: string;
      source_id: string | null;
      legal_name: string;
      normalized_name: string;
    };
    status: string;
    submitted_at: string | null;
    bid_total: number | null;
    document_ids: string[];
  }>;
  documents: Array<{
    document_id: string;
    document_type: string;
    file_name: string;
    ingest_status: string;
  }>;
  provenance: Array<{
    source_system: string;
    source_record_id: string;
    retrieved_at: string;
    effective_at: string | null;
    raw_payload_hash: string;
    raw_payload_location: string;
    parser_version: string;
    legal_basis_tag: "PUBLIC_INFORMATION" | "AUTHORIZED_PROCUREMENT" | "CONSENT" | "DSA" | "SYNTHETIC";
    retention_class: "PUBLIC_ARCHIVE" | "PROCUREMENT_CASE" | "PERSONAL_RESTRICTED" | "TEMPORARY_ENRICHMENT";
  }>;
  quality: {
    completeness_by_module: Record<string, number>;
    quality_flags: string[];
    low_confidence_field_count: number;
    unresolved_entity_count: number;
  };
};

export type ValidatedBundle = {
  snapshot: CanonicalSnapshot;
  fileHash: string;
  snapshotHash: string;
  byteSize: number;
  mimeType: "application/json" | "application/zip";
};

function invalidBundle(message: string): never {
  throw new DomainError("INVALID_CANONICAL_BUNDLE", message, 422);
}

function parseJson(buffer: Buffer) {
  if (buffer.byteLength > MAX_CANONICAL_BYTES) invalidBundle("Canonical JSON exceeds 10 MiB.");
  try {
    const snapshot = parseCanonicalPackage<CanonicalSnapshot>(JSON.parse(buffer.toString("utf8")));
    if (snapshot.package.participant_count !== snapshot.participants.length) {
      invalidBundle("Participant count does not match the canonical participant records.");
    }
    if (Date.parse(snapshot.package.analysis_cutoff_at) < Date.parse(snapshot.package.bid_deadline_at)) {
      invalidBundle("Analysis cutoff cannot precede the bid deadline.");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    invalidBundle("Canonical JSON does not satisfy the frozen v1 contract.");
  }
}

function openZip(buffer: Buffer) {
  return new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) reject(error ?? new Error("Unable to open ZIP archive."));
      else resolve(zip);
    });
  });
}

function readEntry(zip: ZipFile, entry: Entry) {
  return new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error("Unable to read ZIP entry."));
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_CANONICAL_BYTES) stream.destroy(new Error("Canonical JSON exceeds 10 MiB."));
        else chunks.push(chunk);
      });
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

async function canonicalFromZip(buffer: Buffer) {
  let zip: ZipFile | null = null;
  try {
    zip = await openZip(buffer);
    return await new Promise<CanonicalSnapshot>((resolve, reject) => {
      let entries = 0;
      let expandedBytes = 0;
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
        zip?.close();
      };

      zip?.on("entry", (entry: Entry) => {
        entries += 1;
        expandedBytes += entry.uncompressedSize;
        const normalized = posix.normalize(entry.fileName.replaceAll("\\", "/"));
        if (
          entries > MAX_ARCHIVE_ENTRIES ||
          expandedBytes > MAX_EXPANDED_BYTES ||
          normalized.startsWith("/") ||
          normalized === ".." ||
          normalized.startsWith("../")
        ) {
          fail(new Error("ZIP archive violates intake limits."));
          return;
        }

        if (!settled && CANONICAL_NAMES.has(basename(normalized).toLowerCase())) {
          readEntry(zip as ZipFile, entry)
            .then((json) => {
              if (settled) return;
              settled = true;
              resolve(parseJson(json));
              zip?.close();
            })
            .catch(fail);
          return;
        }
        zip?.readEntry();
      });
      zip?.once("end", () => {
        if (!settled) fail(new Error("ZIP archive does not contain canonical-package.json."));
      });
      zip?.once("error", fail);
      zip?.readEntry();
    });
  } catch {
    invalidBundle("ZIP must be safe and contain canonical-package.json.");
  } finally {
    zip?.close();
  }
}

export function acceptedBundleMetadata(fileName: string, byteSize: number, mimeType: string) {
  const extension = fileName.toLowerCase().match(/\.(json|zip)$/)?.[1];
  if (!extension || byteSize < 1 || byteSize > MAX_UPLOAD_BYTES) return false;
  const allowedMime = extension === "json"
    ? ["application/json", "text/json", "application/octet-stream"]
    : ["application/zip", "application/x-zip-compressed", "application/octet-stream"];
  return allowedMime.includes(mimeType.toLowerCase());
}

export async function validateCanonicalBundle(
  bytes: ArrayBuffer,
  fileName: string,
): Promise<ValidatedBundle> {
  const buffer = Buffer.from(bytes);
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    invalidBundle("Bundle size is outside the accepted limit.");
  }

  const extension = fileName.toLowerCase().endsWith(".json") ? "json" :
    fileName.toLowerCase().endsWith(".zip") ? "zip" : null;
  if (!extension) invalidBundle("Only canonical JSON and ZIP bundles are accepted.");

  const firstNonWhitespace = buffer.toString("utf8", 0, Math.min(buffer.length, 128)).trimStart()[0];
  const zipMagic = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08));
  if ((extension === "json" && firstNonWhitespace !== "{") || (extension === "zip" && !zipMagic)) {
    invalidBundle("File content does not match its extension.");
  }

  const snapshot = extension === "json" ? parseJson(buffer) : await canonicalFromZip(buffer);
  return {
    snapshot,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    snapshotHash: contentHash(snapshot),
    byteSize: buffer.byteLength,
    mimeType: extension === "json" ? "application/json" : "application/zip",
  };
}
