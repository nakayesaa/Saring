import "server-only";

import { createHash } from "node:crypto";
import type {
  PriceEngineInput,
  PriceEngineTarget,
  Scalar,
  TriState,
} from "@/lib/price-engine/contracts";
import {
  ContractValidationError,
  parseCanonicalPackage,
  parsePriceEngineInput,
} from "@/lib/price-engine/validation";

type CanonicalItem = {
  item_id: string;
  description: string;
  brand: string | null;
  model: string | null;
  part_number: string | null;
  quantity: number;
  unit: string;
  hps_unit_price: number | null;
  specifications: Record<string, Scalar>;
  tax_included: boolean | "UNKNOWN";
  shipping_included: boolean | "UNKNOWN";
  installation_included: boolean | "UNKNOWN";
  warranty_months: number | null;
};

type CanonicalPackage = {
  package: {
    package_id: string;
    category_code: string | null;
    region_code: string | null;
    currency: string;
    bid_deadline_at: string;
    analysis_cutoff_at: string;
    participant_count: number;
  };
  items: CanonicalItem[];
  participants: Array<{
    participation_id: string;
    vendor: { vendor_id: string };
    submitted_at: string | null;
    items: Array<{
      item_id: string;
      offered_unit_price: number | null;
      quantity: number;
      offered_specifications: Record<string, Scalar>;
    }>;
  }>;
  quality: { completeness_by_module: { price: number } };
};

export type PriceTargetIdentity = {
  targetId: string;
  itemId: string;
  participationId: string;
  vendorId: string;
};

export type PriceInputAdapterOptions = {
  runId: string;
  engineVersion: string;
  comparatorSnapshotId: string;
  evidenceLocatorIdsFor: (identity: PriceTargetIdentity) => string[];
};

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

export function contentHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function triState(value: boolean | "UNKNOWN"): TriState {
  if (value === "UNKNOWN") return "UNKNOWN";
  return value ? "INCLUDED" : "EXCLUDED";
}

function targetId(participationId: string, itemId: string) {
  return `PRICE:${participationId}:${itemId}`;
}

function buildTarget(
  canonical: CanonicalPackage,
  item: CanonicalItem,
  participant: CanonicalPackage["participants"][number],
  offer: CanonicalPackage["participants"][number]["items"][number],
  options: PriceInputAdapterOptions,
): PriceEngineTarget | null {
  if (offer.offered_unit_price === null) return null;
  const id = targetId(participant.participation_id, item.item_id);
  const identity = {
    targetId: id,
    itemId: item.item_id,
    participationId: participant.participation_id,
    vendorId: participant.vendor.vendor_id,
  };
  const locatorIds = options.evidenceLocatorIdsFor(identity);
  if (!locatorIds.length) {
    throw new ContractValidationError("price-input-adapter", [
      `${id} has no evidence locator`,
    ]);
  }

  const specifications = { ...item.specifications, ...offer.offered_specifications };
  const resolutionLevel = item.part_number
    ? "EXACT_SKU"
    : Object.keys(specifications).length >= 3
      ? "STRICT_CONFIGURATION"
      : "UNRESOLVED";
  const condition = specifications.condition;

  return {
    target_id: id,
    item_id: item.item_id,
    participation_id: participant.participation_id,
    participant_id: participant.participation_id,
    vendor_id: participant.vendor.vendor_id,
    description: item.description,
    quoted_unit_price: offer.offered_unit_price,
    quantity: offer.quantity,
    unit: item.unit,
    currency: canonical.package.currency,
    procurement_date: participant.submitted_at ?? canonical.package.bid_deadline_at,
    region_code: canonical.package.region_code,
    normalized_product: {
      category_code: canonical.package.category_code ?? "UNCLASSIFIED",
      brand: item.brand,
      model: item.model,
      part_number: item.part_number,
      condition:
        condition === "NEW" || condition === "USED" || condition === "REFURBISHED"
          ? condition
          : "UNKNOWN",
      specifications,
      configuration_fingerprint: contentHash({
        category: canonical.package.category_code,
        brand: item.brand,
        model: item.model,
        partNumber: item.part_number,
        specifications,
      }),
      resolution_level: resolutionLevel,
    },
    commercial_basis: {
      tax: triState(item.tax_included),
      shipping: triState(item.shipping_included),
      installation: triState(item.installation_included),
      configuration_service: "UNKNOWN",
      bundled_software_service: "UNKNOWN",
      warranty_months: item.warranty_months,
      delivery_days: null,
      payment_terms_code: null,
    },
    hps_unit_price: item.hps_unit_price,
    field_quality: {
      overall: canonical.quality.completeness_by_module.price,
      material_fields: Object.fromEntries(
        Object.keys(specifications).map((field) => [
          field,
          { confidence: 1, status: "REVIEWED", locator_id: locatorIds[0] },
        ]),
      ),
    },
    evidence_locator_ids: locatorIds,
  };
}

export function buildPriceEngineInput(
  value: unknown,
  options: PriceInputAdapterOptions,
): PriceEngineInput {
  const canonical = parseCanonicalPackage<CanonicalPackage>(value);
  if (canonical.package.participant_count !== canonical.participants.length) {
    throw new ContractValidationError("canonical-package-invariants", [
      "/package/participant_count must equal /participants length",
    ]);
  }

  const items = new Map(canonical.items.map((item) => [item.item_id, item]));
  const targets = canonical.participants.flatMap((participant) =>
    participant.items.flatMap((offer) => {
      const item = items.get(offer.item_id);
      if (!item) {
        throw new ContractValidationError("canonical-package-invariants", [
          `offered item ${offer.item_id} does not resolve to a package item`,
        ]);
      }
      const target = buildTarget(canonical, item, participant, offer, options);
      return target ? [target] : [];
    }),
  );

  if (!targets.length) {
    throw new ContractValidationError("price-input-adapter", [
      "no participant-item quote is eligible for Price Engine input",
    ]);
  }

  return parsePriceEngineInput({
    schema_version: "saring-price-engine-input-1.0.0",
    run_id: options.runId,
    package_id: canonical.package.package_id,
    analysis_cutoff: canonical.package.analysis_cutoff_at,
    canonical_input_hash: contentHash(canonical),
    requested_engine_version: options.engineVersion,
    comparator_snapshot_id: options.comparatorSnapshotId,
    targets,
  });
}
