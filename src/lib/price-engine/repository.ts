import "server-only";

import goldenCanonicalPackage from "../../../fixtures/price-engine/golden-canonical-package.json";
import type { EvidenceLocator } from "@/lib/price-engine/contracts";
import type { PriceTargetIdentity } from "@/lib/price-engine/adapter";

export interface PriceAnalysisRepository {
  getCanonicalPackage(packageId: string): Promise<unknown | null>;
  evidenceLocatorIdsFor(identity: PriceTargetIdentity): string[];
  resolveEvidenceLocators(packageId: string, locatorIds: string[]): Promise<EvidenceLocator[]>;
}

const HASH = {
  canonical: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  quote: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  comparator: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
} as const;

function quoteLocatorId(vendorId: string) {
  return `LOC-QUOTE-${vendorId}`;
}

function itemLocatorId(itemId: string) {
  return `LOC-ITEM-${itemId}`;
}

function hpsLocatorId(itemId: string) {
  return `LOC-HPS-${itemId}`;
}

function fixtureLocator(packageId: string, locatorId: string): EvidenceLocator | null {
  if (locatorId.startsWith("LOC-QUOTE-")) {
    const vendorId = locatorId.slice("LOC-QUOTE-".length);
    return {
      schema_version: "saring-evidence-locator-1.0.0",
      locator_id: locatorId,
      package_id: packageId,
      source_type: "TABLE_CELL",
      source_hash: HASH.quote,
      table_name: "participant_items",
      row_key: `${vendorId}:LAPTOP-BISNIS-16-512`,
      column_name: "offered_unit_price",
      excerpt: `Harga penawaran per unit ${vendorId}`,
      label: "Harga penawaran per unit",
    };
  }
  if (locatorId.startsWith("LOC-ITEM-")) {
    const itemId = locatorId.slice("LOC-ITEM-".length);
    return {
      schema_version: "saring-evidence-locator-1.0.0",
      locator_id: locatorId,
      package_id: packageId,
      source_type: "JSON_PATH",
      source_hash: HASH.canonical,
      json_path: `$.items[?(@.item_id=='${itemId}')].specifications`,
      label: "Spesifikasi canonical item",
    };
  }
  if (locatorId.startsWith("LOC-HPS-")) {
    const itemId = locatorId.slice("LOC-HPS-".length);
    return {
      schema_version: "saring-evidence-locator-1.0.0",
      locator_id: locatorId,
      package_id: packageId,
      source_type: "TABLE_CELL",
      source_hash: HASH.canonical,
      table_name: "items",
      row_key: itemId,
      column_name: "hps_unit_price",
      label: "HPS per unit",
    };
  }
  if (locatorId.startsWith("LOC-COMP-")) {
    const observationId = locatorId.replace("LOC-COMP-", "OBS-LAPTOP-");
    return {
      schema_version: "saring-evidence-locator-1.0.0",
      locator_id: locatorId,
      package_id: packageId,
      source_type: "DATABASE_RECORD",
      source_hash: HASH.comparator,
      record_type: "PRICE_OBSERVATION",
      record_id: observationId,
      label: "Historical price observation",
    };
  }
  return null;
}

export class FixturePriceAnalysisRepository implements PriceAnalysisRepository {
  async getCanonicalPackage(packageId: string) {
    return goldenCanonicalPackage.package.package_id === packageId
      ? goldenCanonicalPackage
      : null;
  }

  evidenceLocatorIdsFor(identity: PriceTargetIdentity) {
    return [
      quoteLocatorId(identity.vendorId),
      itemLocatorId(identity.itemId),
      hpsLocatorId(identity.itemId),
    ];
  }

  async resolveEvidenceLocators(packageId: string, locatorIds: string[]) {
    const uniqueIds = [...new Set(locatorIds)];
    const locators = uniqueIds.map((id) => fixtureLocator(packageId, id));
    if (locators.some((locator) => locator === null)) {
      const missing = uniqueIds.filter((_, index) => locators[index] === null);
      throw new Error(`Fixture locator registry is missing: ${missing.join(", ")}`);
    }
    return locators as EvidenceLocator[];
  }
}
