import "server-only";

import { createHash } from "node:crypto";
import { basename, posix } from "node:path";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import {
  PACKAGE_BUNDLE_CONTRACT,
  parsePackageBundleManifest,
  parseRuntimeBundleManifest,
  RUNTIME_BUNDLE_CONTRACT,
  type PackageBundleManifest,
  type RuntimeBundleManifest,
} from "@/lib/intake/contracts";
import { MAX_UPLOAD_BYTES } from "@/lib/intake/validation";

const MAX_ARCHIVE_ENTRIES = 500;
const MAX_EXPANDED_BYTES = 250 * 1024 * 1024;
const MAX_METADATA_BYTES = 10 * 1024 * 1024;

const packageMetadataSchema = z.strictObject({
  canonical_id: z.string().min(1).max(240),
  name: z.string().min(1).max(500),
  buyer: z.string().min(1).max(500),
  procurement_method: z.string().min(1).max(240),
  anchor_reference_id: z.string().min(1).max(240).optional(),
  announcement_at: z.iso.datetime({ offset: true }).optional(),
  bid_deadline_at: z.iso.datetime({ offset: true }),
  analysis_cutoff_at: z.iso.datetime({ offset: true }),
  award_at: z.iso.datetime({ offset: true }).optional(),
  participant_count: z.number().int().nonnegative(),
  bid_row_count: z.number().int().nonnegative().optional(),
  item_count: z.number().int().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  data_origin: z.string().min(1).max(240).optional(),
});

export type HybridPackageMetadata = z.infer<typeof packageMetadataSchema>;

export type ValidatedHybridBundle = {
  kind: "RAW_HYBRID";
  manifest: PackageBundleManifest | RuntimeBundleManifest;
  package: HybridPackageMetadata;
  sourceId: string;
  legalBasisTag: PackageBundleManifest["legal_basis_tag"];
  inputContractVersion: typeof PACKAGE_BUNDLE_CONTRACT | typeof RUNTIME_BUNDLE_CONTRACT;
  expectedFileCount: number;
  fileHash: string;
  byteSize: number;
  mimeType: "application/zip";
  archivePrefix: string;
  evaluatorAssetsPresent: boolean;
};

function invalid(code: string, message: string): never {
  throw new DomainError(code, message, 422);
}

function safePath(fileName: string) {
  const slashPath = fileName.replaceAll("\\", "/");
  const normalized = posix.normalize(slashPath);
  if (
    slashPath.includes("\0") ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    invalid("UNSAFE_BUNDLE_ARCHIVE", "The archive contains an unsafe path.");
  }
  return normalized.replace(/^\.\//, "");
}

function isSymlink(entry: Entry) {
  const madeByUnix = entry.versionMadeBy >> 8 === 3;
  const unixMode = entry.externalFileAttributes >>> 16;
  return madeByUnix && (unixMode & 0o170000) === 0o120000;
}

function openZip(buffer: Buffer) {
  return new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, autoClose: false },
      (error, zip) => error || !zip ? reject(error ?? new Error("Unable to open ZIP archive.")) : resolve(zip),
    );
  });
}

function collectEntries(zip: ZipFile) {
  return new Promise<Map<string, Entry>>((resolve, reject) => {
    const entries = new Map<string, Entry>();
    let count = 0;
    let expandedBytes = 0;

    const fail = (error: unknown) => reject(error);
    zip.once("error", fail);
    zip.on("entry", (entry: Entry) => {
      try {
        count += 1;
        expandedBytes += entry.uncompressedSize;
        if (count > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_EXPANDED_BYTES) {
          invalid("UNSAFE_BUNDLE_ARCHIVE", "The archive exceeds safe expansion limits.");
        }
        if ((entry.generalPurposeBitFlag & 0x1) !== 0 || isSymlink(entry)) {
          invalid("UNSAFE_BUNDLE_ARCHIVE", "Encrypted files and symbolic links are not accepted.");
        }
        const path = safePath(entry.fileName);
        if (!path.endsWith("/")) {
          if (entries.has(path)) invalid("UNSAFE_BUNDLE_ARCHIVE", "The archive contains duplicate paths.");
          entries.set(path, entry);
        }
        zip.readEntry();
      } catch (error) {
        fail(error);
      }
    });
    zip.once("end", () => resolve(entries));
    zip.readEntry();
  });
}

function readEntry(zip: ZipFile, entry: Entry, maxBytes = MAX_METADATA_BYTES) {
  return new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error("Unable to read ZIP entry."));
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) stream.destroy(new Error("ZIP entry exceeds its allowed size."));
        else chunks.push(chunk);
      });
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

function hashEntry(zip: ZipFile, entry: Entry) {
  return new Promise<string>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error("Unable to hash ZIP entry."));
      const hash = createHash("sha256");
      stream.on("data", (chunk: Buffer) => hash.update(chunk));
      stream.once("error", reject);
      stream.once("end", () => resolve(hash.digest("hex")));
    });
  });
}

function parseJson(buffer: Buffer, label: string) {
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    invalid("INVALID_BUNDLE_METADATA", `${label} is not valid JSON.`);
  }
}

async function findManifest(zip: ZipFile, entries: Map<string, Entry>) {
  const candidates = [...entries.entries()].filter(([path]) =>
    ["manifest.json", "runtime-bundle-manifest.json"].includes(basename(path).toLowerCase()),
  );
  const valid: Array<{ path: string; manifest: PackageBundleManifest | RuntimeBundleManifest }> = [];
  for (const [path, entry] of candidates) {
    try {
      const raw = parseJson(await readEntry(zip, entry), path);
      const manifest = basename(path).toLowerCase() === "runtime-bundle-manifest.json"
        ? parseRuntimeBundleManifest(raw)
        : parsePackageBundleManifest(raw);
      valid.push({ path, manifest });
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "INVALID_BUNDLE_MANIFEST")) throw error;
    }
  }
  if (valid.length === 0) invalid("NOT_HYBRID_BUNDLE", "No SARING hybrid bundle manifest was found.");
  if (valid.length > 1) invalid("INVALID_BUNDLE_MANIFEST", "The archive contains multiple valid bundle manifests.");
  return valid[0];
}

function isRuntimeManifest(manifest: PackageBundleManifest | RuntimeBundleManifest): manifest is RuntimeBundleManifest {
  return "schema_version" in manifest && manifest.schema_version === RUNTIME_BUNDLE_CONTRACT;
}

export async function validateHybridBundle(bytes: ArrayBuffer): Promise<ValidatedHybridBundle> {
  const buffer = Buffer.from(bytes);
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    invalid("INVALID_HYBRID_BUNDLE", "The hybrid bundle size is outside the accepted limit.");
  }
  const zipMagic = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!zipMagic) invalid("NOT_HYBRID_BUNDLE", "The uploaded file is not a ZIP archive.");

  let zip: ZipFile | null = null;
  try {
    zip = await openZip(buffer);
    const entries = await collectEntries(zip);
    const { path: manifestPath, manifest } = await findManifest(zip, entries);
    const manifestName = basename(manifestPath);
    const archivePrefix = manifestPath.slice(0, -manifestName.length);
    const expectedPaths = new Set([manifestPath]);
    const inventory = isRuntimeManifest(manifest)
      ? manifest.files.map((file) => ({ relativePath: file.path, sizeBytes: file.size_bytes, sha256: file.sha256 }))
      : manifest.expected_files.map((file) => ({ relativePath: file.relative_path, sizeBytes: file.size_bytes, sha256: file.sha256 }));

    for (const expected of inventory) {
      const relativePath = safePath(expected.relativePath);
      if (relativePath !== expected.relativePath || ["manifest.json", "runtime-bundle-manifest.json"].includes(relativePath)) {
        invalid("INVALID_BUNDLE_MANIFEST", "Manifest paths must be normalized and relative to the bundle root.");
      }
      const path = `${archivePrefix}${relativePath}`;
      if (expectedPaths.has(path)) invalid("INVALID_BUNDLE_MANIFEST", "Manifest paths must be unique.");
      expectedPaths.add(path);
      const entry = entries.get(path);
      if (!entry || entry.uncompressedSize !== expected.sizeBytes) {
        invalid("BUNDLE_INTEGRITY_MISMATCH", `Missing file or size mismatch: ${relativePath}`);
      }
      if ((await hashEntry(zip, entry)).toLowerCase() !== expected.sha256.toLowerCase()) {
        invalid("BUNDLE_INTEGRITY_MISMATCH", `SHA-256 mismatch: ${relativePath}`);
      }
    }
    const actualPaths = new Set(entries.keys());
    if (actualPaths.size !== expectedPaths.size || [...actualPaths].some((path) => !expectedPaths.has(path))) {
      invalid("BUNDLE_FILE_SET_MISMATCH", "Archive files do not exactly match the manifest inventory.");
    }

    const packageCandidates = inventory.filter(({ relativePath }) =>
      /^package_[^/]+\/package\.json$/.test(relativePath),
    );
    if (packageCandidates.length !== 1) {
      invalid("INVALID_BUNDLE_METADATA", "The bundle must contain exactly one package metadata file.");
    }
    const packagePath = `${archivePrefix}${packageCandidates[0].relativePath}`;
    const packageMetadata = packageMetadataSchema.parse(parseJson(await readEntry(zip, entries.get(packagePath)!), packagePath));
    const sourceId = isRuntimeManifest(manifest) ? manifest.package_id : manifest.tender_source_id;
    if (
      packageMetadata.canonical_id !== sourceId ||
      packageMetadata.analysis_cutoff_at !== manifest.analysis_cutoff_at ||
      (!isRuntimeManifest(manifest) && packageMetadata.participant_count !== manifest.participant_count) ||
      Date.parse(packageMetadata.analysis_cutoff_at) < Date.parse(packageMetadata.bid_deadline_at)
    ) {
      invalid("BUNDLE_IDENTITY_MISMATCH", "Package metadata does not reconcile with the bundle manifest.");
    }

    return {
      kind: "RAW_HYBRID",
      manifest,
      package: packageMetadata,
      sourceId,
      legalBasisTag: isRuntimeManifest(manifest)
        ? manifest.bundle_mode === "SYNTHETIC" ? "SYNTHETIC" : "AUTHORIZED_PROCUREMENT"
        : manifest.legal_basis_tag,
      inputContractVersion: isRuntimeManifest(manifest) ? RUNTIME_BUNDLE_CONTRACT : PACKAGE_BUNDLE_CONTRACT,
      expectedFileCount: inventory.length,
      fileHash: createHash("sha256").update(buffer).digest("hex"),
      byteSize: buffer.byteLength,
      mimeType: "application/zip",
      archivePrefix,
      evaluatorAssetsPresent: inventory.some(({ relativePath }) =>
        relativePath.includes("/ground_truth/") || relativePath.includes("/evidence_brief/")),
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof z.ZodError) invalid("INVALID_BUNDLE_METADATA", "Package metadata does not satisfy the intake contract.");
    invalid("INVALID_HYBRID_BUNDLE", "The hybrid evidence bundle could not be validated.");
  } finally {
    zip?.close();
  }
  throw new Error("Unreachable hybrid bundle validation state.");
}
