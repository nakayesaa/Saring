import { formatIdr, type GoldenCase } from "@/lib/golden-case";
import type { CanonicalSnapshot } from "@/lib/intake/validation";
import type { CanonicalAnalysisSnapshot } from "@/lib/intake/contracts";

export type ReadinessCheck = {
  label: string;
  value: number;
  detail: string;
  status: "Ready" | "Ready with warning" | "Partial context";
  explanation: string;
  consequence: string;
};

const goldenReadinessChecks: readonly ReadinessCheck[] = [
  { label: "Canonical contract", value: 100, detail: "Package identity, cutoff, currency, and provenance resolve.", status: "Ready", explanation: "The manifest, source hashes, package identity, and analysis cutoff passed validation.", consequence: "Every accepted record can be traced to its immutable source during analysis." },
  { label: "Price intelligence", value: 100, detail: "15 commercial offers and normalized laptop specifications.", status: "Ready", explanation: "Comparable price observations and required product attributes are complete for this package.", consequence: "The price engine can calculate its comparator range without dropping any offer." },
  { label: "Document intelligence", value: 96, detail: "One low-confidence field will trigger an explicit abstention.", status: "Ready with warning", explanation: "A warranty field could not be extracted with sufficient confidence from its source document.", consequence: "Document analysis will continue, but that field is excluded and reported as an abstention." },
  { label: "Relationship intelligence", value: 82, detail: "Historical participation available; ownership enrichment unavailable.", status: "Partial context", explanation: "Dated participation history is available, while verified ownership enrichment is not present.", consequence: "The graph engine will use participation edges only and will not infer ownership relationships." },
];

export function buildGoldenReadiness(item: GoldenCase) {
  return {
    summary: [
      { label: "Package", value: item.id },
      { label: "Participants", value: `${item.participantCount} vendors` },
      { label: "HPS", value: formatIdr(item.hpsTotal) },
      { label: "Analysis cutoff", value: item.analysisCutoffAt },
    ],
    checks: goldenReadinessChecks,
  };
}

export function buildCanonicalReadiness(snapshot: CanonicalSnapshot) {
  const quality = snapshot.quality.completeness_by_module;
  const coverage = (key: string) => Math.round((quality[key] ?? 0) * 100);
  const checks: readonly ReadinessCheck[] = [
    { label: "Canonical contract", value: 100, detail: "Schema, package identity, cutoff, and provenance passed validation.", status: "Ready", explanation: "The uploaded snapshot satisfies the frozen canonical v1 contract and integrity checks.", consequence: "Analysis receives one immutable, content-addressed snapshot." },
    { label: "Price intelligence", value: coverage("price"), detail: `${snapshot.items.length} canonical item records are available.`, status: coverage("price") >= 80 ? "Ready" : "Partial context", explanation: "Coverage is derived from material price fields in the canonical snapshot.", consequence: "The engine must abstain for items that lack sufficient comparable context." },
    { label: "Document intelligence", value: coverage("document"), detail: `${snapshot.documents.length} document records are registered.`, status: snapshot.quality.low_confidence_field_count ? "Ready with warning" : "Ready", explanation: snapshot.quality.low_confidence_field_count ? `${snapshot.quality.low_confidence_field_count} low-confidence fields remain visible.` : "Document records passed canonical completeness checks.", consequence: "Low-confidence fields remain excluded until reviewed." },
    { label: "Relationship intelligence", value: coverage("graph"), detail: `${snapshot.participants.length} participant identities are available.`, status: snapshot.quality.unresolved_entity_count ? "Partial context" : "Ready", explanation: snapshot.quality.unresolved_entity_count ? `${snapshot.quality.unresolved_entity_count} entities remain unresolved.` : "Participant identities are resolved for graph construction.", consequence: "Unresolved identities cannot create positive relationship evidence." },
  ];
  return {
    summary: [
      { label: "Package", value: snapshot.package.package_id },
      { label: "Participants", value: `${snapshot.package.participant_count} vendors` },
      { label: "HPS", value: snapshot.package.hps_total === null ? "Not supplied" : formatIdr(snapshot.package.hps_total) },
      { label: "Analysis cutoff", value: snapshot.package.analysis_cutoff_at },
    ],
    checks,
  };
}

export function buildAnalysisSnapshotReadiness(snapshot: CanonicalAnalysisSnapshot) {
  const documentCoverage = Math.round(snapshot.quality.document_completeness * 100);
  const priceCoverage = snapshot.items.length && snapshot.bids.length
    ? snapshot.price_comparators.length ? 100 : 70
    : 0;
  const graphCoverage = snapshot.participants.length
    ? snapshot.historical_participation.length ? 100 : 65
    : 0;
  const hasDocumentWarning = snapshot.quality.needs_review_documents > 0 ||
    snapshot.quality.unreadable_documents > 0 || snapshot.quality.low_confidence_pages > 0;
  const hpsTotal = snapshot.items.reduce((total, item) => total + item.hps_total, 0);
  const checks: readonly ReadinessCheck[] = [
    { label: "Canonical contract", value: 100, detail: "Snapshot identity, cutoff, hashes, and provenance passed validation.", status: "Ready", explanation: "The Python parser output satisfies the frozen canonical analysis snapshot contract.", consequence: "Analysis receives one immutable, content-addressed snapshot." },
    { label: "Price intelligence", value: priceCoverage, detail: `${snapshot.items.length} items, ${snapshot.bids.length} bids, and ${snapshot.price_comparators.length} comparators.`, status: priceCoverage >= 80 ? "Ready" : "Partial context", explanation: "Coverage reflects the available item, bid, and comparator records.", consequence: "Items without a defensible cohort must abstain." },
    { label: "Document intelligence", value: documentCoverage, detail: `${snapshot.documents.length} bidder documents; ${snapshot.quality.ocr_pages} OCR pages.`, status: hasDocumentWarning ? "Ready with warning" : "Ready", explanation: hasDocumentWarning ? "Low-confidence or unreadable material remains explicitly visible." : "All registered documents were parsed without review warnings.", consequence: "Uncertain pages remain excluded until reviewed." },
    { label: "Relationship intelligence", value: graphCoverage, detail: `${snapshot.participants.length} participants and ${snapshot.historical_participation.length} dated historical records.`, status: graphCoverage >= 80 ? "Ready" : "Partial context", explanation: "Graph coverage depends on resolved participants and pre-cutoff history.", consequence: "Missing historical context cannot create positive relationship evidence." },
  ];
  return {
    summary: [
      { label: "Package", value: snapshot.package_id },
      { label: "Participants", value: `${snapshot.participants.length} vendors` },
      { label: "HPS", value: formatIdr(hpsTotal) },
      { label: "Analysis cutoff", value: snapshot.analysis_cutoff_at },
    ],
    checks,
  };
}
