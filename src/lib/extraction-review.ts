import type { GoldenCase } from "@/lib/golden-case";
import { formatIdr } from "@/lib/golden-case";
import type { CanonicalSnapshot } from "@/lib/intake/validation";

export type ExtractionCategoryKey =
  | "overview"
  | "requirements"
  | "pricing"
  | "vendors"
  | "metadata";

export type ExtractionField = {
  id: string;
  label: string;
  value: string;
  source: string;
  locator: string;
  confidence: number;
  excerpt: string;
  status: "VERIFIED" | "NEEDS_REVIEW";
  suggestedValue?: string;
};

export type ExtractionCategory = {
  key: ExtractionCategoryKey;
  label: string;
  description: string;
  fields: ExtractionField[];
};

export type ExtractionReviewViewModel = {
  packageId: string;
  packageName: string;
  schemaVersion: string;
  parserVersion: string;
  categories: ExtractionCategory[];
};

/**
 * Fixture adapter for the current vertical slice. The UI only consumes the
 * serializable view model above, so a database repository can replace this
 * adapter without changing the client component.
 */
export function buildGoldenExtractionReview(item: GoldenCase): ExtractionReviewViewModel {
  return {
    packageId: item.id,
    packageName: item.name,
    schemaVersion: "saring-canonical-package-1.0.0",
    parserVersion: "document-extraction-demo-1.0.0",
    categories: [
      {
        key: "overview",
        label: "Overview",
        description: "Package identity and procurement context",
        fields: [
          field("package-name", "Package name", item.name, "package.json", "$.package.name"),
          field("buyer", "Buyer institution", item.buyer, "package.json", "$.package.buyer.institution_name"),
          field("buyer-unit", "Procurement unit", item.buyerUnit, "package.json", "$.package.buyer.unit_name"),
          field("method", "Procurement method", item.method, "dokumen_pemilihan.pdf", "Page 4 · Selection method"),
          field("category", "Category", item.category, "spesifikasi_kak.pdf", "Page 2 · Scope"),
          field("cutoff", "Analysis cutoff", item.analysisCutoffAt, "manifest.json", "$.analysis_cutoff_at"),
        ],
      },
      {
        key: "requirements",
        label: "Requirements",
        description: "Extracted KAK and technical requirements",
        fields: [
          field("quantity", "Required quantity", "3,000 units", "spesifikasi_kak.pdf", "Page 3 · Quantity"),
          field("ram", "Minimum memory", "16 GB RAM", "spesifikasi_kak.pdf", "Page 5 · Memory"),
          field("storage", "Minimum storage", "512 GB SSD", "spesifikasi_kak.pdf", "Page 5 · Storage"),
          field("warranty", "Minimum warranty", "3 years", "spesifikasi_kak.pdf", "Page 7 · Warranty"),
          field("delivery", "Delivery requirement", "60 calendar days", "dokumen_pemilihan.pdf", "Page 18 · Schedule"),
        ],
      },
      {
        key: "pricing",
        label: "Pricing",
        description: "HPS and submitted commercial values",
        fields: [
          field("hps-total", "Total HPS", formatIdr(item.hpsTotal), "hps_items.csv", "Row 1 · hps_total"),
          field("hps-unit", "HPS per unit", formatIdr(item.hpsTotal / 3000), "hps_items.csv", "Row 1 · unit_price"),
          field("bid-range", "Submitted bid range", "Rp34.50B – Rp43.50B", "bid_summary.csv", "Rows 1–15 · bid_total"),
          field("currency", "Currency", "IDR", "package.json", "$.package.currency"),
        ],
      },
      {
        key: "vendors",
        label: "Vendors",
        description: "Participant identity and submission extraction",
        fields: [
          field("participant-count", "Submitted vendors", `${item.participantCount} vendors`, "participants.csv", "15 reconciled rows"),
          field("resolved-vendors", "Resolved vendor identities", "15 of 15", "canonical_vendors.json", "$.vendors"),
          field("complete-submissions", "Complete submissions", "14 of 15", "document_inventory.csv", "Vendor submission reconciliation"),
          {
            id: "vendor-14-warranty",
            label: "Vendor 14 warranty",
            value: "OCR uncertain: “3 thn”",
            source: "technical_offer_SYN-V014.pdf",
            locator: "Page 8 · Warranty table · row 3",
            confidence: 0.46,
            excerpt: "Garansi perangkat ... 3 thn ... termasuk layanan purnajual.",
            status: "NEEDS_REVIEW",
            suggestedValue: "3 years",
          },
        ],
      },
      {
        key: "metadata",
        label: "Metadata",
        description: "Manifest, provenance, and canonical contract",
        fields: [
          field("record-count", "Canonical records", `${item.fileCount} records`, "manifest.json", "$.expected_files"),
          field("manifest-hash", "Manifest SHA-256", "7b4e…d921 verified", "manifest.json", "$.manifest_sha256"),
          field("schema-version", "Canonical schema", "saring-canonical-package-1.0.0", "canonical_package.json", "$.schema_version"),
          field("legal-basis", "Legal basis", "Authorized procurement", "authority/access_basis.json", "$.legal_basis_tag"),
          field("bundle-mode", "Bundle mode", "Synthetic demonstration", "manifest.json", "$.bundle_mode"),
        ],
      },
    ],
  };
}

function field(id: string, label: string, value: string, source: string, locator: string): ExtractionField {
  return {
    id,
    label,
    value,
    source,
    locator,
    confidence: 0.98,
    excerpt: `${label}: ${value}`,
    status: "VERIFIED",
  };
}

export function buildCanonicalExtractionReview(snapshot: CanonicalSnapshot): ExtractionReviewViewModel {
  const firstItem = snapshot.items[0];
  const firstRequirement = snapshot.requirements[0];
  return {
    packageId: snapshot.package.source_id,
    packageName: snapshot.package.name,
    schemaVersion: snapshot.schema_version,
    parserVersion: snapshot.provenance[0]?.parser_version ?? "unknown",
    categories: [
      {
        key: "overview",
        label: "Overview",
        description: "Validated package identity and procurement context",
        fields: [
          field("package-name", "Package name", snapshot.package.name, "canonical-package.json", "$.package.name"),
          field("buyer", "Buyer institution", snapshot.package.buyer.institution_name, "canonical-package.json", "$.package.buyer.institution_name"),
          field("method", "Procurement method", snapshot.package.procurement_method, "canonical-package.json", "$.package.procurement_method"),
          field("cutoff", "Analysis cutoff", snapshot.package.analysis_cutoff_at, "canonical-package.json", "$.package.analysis_cutoff_at"),
        ],
      },
      {
        key: "requirements",
        label: "Requirements",
        description: "Canonical requirement records",
        fields: [
          field("requirement-count", "Requirements", `${snapshot.requirements.length} records`, "canonical-package.json", "$.requirements"),
          field("first-requirement", "First requirement", firstRequirement ? `${firstRequirement.field}: ${String(firstRequirement.expected_value ?? firstRequirement.status)}` : "No requirement supplied", "canonical-package.json", "$.requirements[0]"),
        ],
      },
      {
        key: "pricing",
        label: "Pricing",
        description: "Canonical HPS and item context",
        fields: [
          field("hps-total", "Total HPS", snapshot.package.hps_total === null ? "Not supplied" : formatIdr(snapshot.package.hps_total), "canonical-package.json", "$.package.hps_total"),
          field("item-count", "Items", `${snapshot.items.length} records`, "canonical-package.json", "$.items"),
          field("first-item", "Primary item", firstItem?.description ?? "No item supplied", "canonical-package.json", "$.items[0]"),
          field("currency", "Currency", snapshot.package.currency, "canonical-package.json", "$.package.currency"),
        ],
      },
      {
        key: "vendors",
        label: "Vendors",
        description: "Participant identity and submission records",
        fields: [
          field("participant-count", "Participants", `${snapshot.participants.length} reconciled vendors`, "canonical-package.json", "$.participants"),
          field("first-vendor", "First participant", snapshot.participants[0]?.vendor.legal_name ?? "No participant supplied", "canonical-package.json", "$.participants[0].vendor"),
        ],
      },
      {
        key: "metadata",
        label: "Metadata",
        description: "Contract, provenance, and quality controls",
        fields: [
          field("document-count", "Documents", `${snapshot.documents.length} records`, "canonical-package.json", "$.documents"),
          field("schema-version", "Canonical schema", snapshot.schema_version, "canonical-package.json", "$.schema_version"),
          field("quality-flags", "Quality flags", snapshot.quality.quality_flags.join(", ") || "None", "canonical-package.json", "$.quality.quality_flags"),
          field("bundle-mode", "Bundle mode", snapshot.package.bundle_mode, "canonical-package.json", "$.package.bundle_mode"),
        ],
      },
    ],
  };
}
