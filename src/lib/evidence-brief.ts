import type { GoldenCase, GoldenFinding } from "@/lib/golden-case";

export type EvidenceBriefModule = "PRICE" | "DOCUMENT" | "GRAPH";
export type EvidenceBriefAction =
  | "CLARIFICATION_REQUESTED"
  | "CONFIRMED_FOR_FOLLOW_UP"
  | "EXTRACTION_CORRECTION"
  | "ENTITY_CORRECTION";

export type BriefCitationView = {
  locator_id: string;
  label: string;
  source: string;
  locator: string;
  excerpt: string;
};

export type BriefModuleView = {
  engine: EvidenceBriefModule;
  label: string;
  score: number;
  confidence: number;
  status: "SCORED";
  finding_count: number;
};

export type BriefFindingView = {
  result_id: string;
  finding_id: string;
  engine: EvidenceBriefModule;
  title: string;
  summary: string;
  confidence: number;
  alternative_explanation: string;
  citations: BriefCitationView[];
};

export type EvidenceBriefViewModel = {
  projection_version: "saring-evidence-brief-ui-1.0.0";
  source_contract_versions: ["saring-evidence-brief-1.0.0", "saring-engine-result-1.0.0"];
  brief_id: string;
  brief_version: string;
  package_id: string;
  package_name: string;
  run_id: string;
  analysis_cutoff_at: string;
  workflow_stage: "PRE_AWARD";
  status: "READY_FOR_REVIEW";
  review_priority: "HIGH";
  narrative: string;
  evidence_completeness: number;
  finding_count: number;
  source_citation_count: number;
  abstention_count: number;
  modules: BriefModuleView[];
  price: BriefFindingView & {
    metrics: {
      item_id: string;
      quantity: number;
      q50: number;
      q90: number;
      hps_unit: number;
      quoted_unit: number;
      relative_deviation: number;
      exposure: number;
    };
  };
  document: BriefFindingView & {
    metrics: {
      vendor_left: string;
      vendor_right: string;
      similarity: number;
      template_excluded: boolean;
      rare_shared_errors: number;
      passage_left: string;
      passage_right: string;
    };
  };
  graph: BriefFindingView & {
    metrics: {
      vendor_ids: [string, string, string];
      vendor_labels: [string, string, string];
      historical_co_bids: number;
      award_rotations: number;
      cutoff_compatible: true;
    };
  };
  limitations: string[];
  recommended_review_actions: Array<{ code: EvidenceBriefAction; label: string }>;
  provenance: {
    audit_log_ref: string;
    renderer: "DETERMINISTIC_TEMPLATE";
    factuality_status: "VERIFIED";
    created_at: string;
    model_versions: Array<{ label: string; value: string }>;
  };
};

const moduleConfiguration: Record<
  EvidenceBriefModule,
  Pick<BriefModuleView, "label" | "score" | "confidence">
> = {
  PRICE: { label: "Harga", score: 0.84, confidence: 0.87 },
  DOCUMENT: { label: "Dokumen", score: 0.79, confidence: 0.82 },
  GRAPH: { label: "Relasi", score: 0.71, confidence: 0.74 },
};

function finding(item: GoldenCase, findingId: string) {
  const value = item.findings.find((candidate) => candidate.id === findingId);
  if (!value) throw new Error(`Golden finding ${findingId} is missing.`);
  return value;
}

function findingView(source: GoldenFinding, engine: EvidenceBriefModule): BriefFindingView {
  return {
    result_id: `RESULT-AR-2026-001-${engine}`,
    finding_id: source.id,
    engine,
    title: source.title,
    summary: source.summary,
    confidence: source.confidence,
    alternative_explanation: source.alternativeExplanation,
    citations: source.citations.map((citation, index) => ({
      locator_id: `LOC-${source.id}-${index + 1}`,
      ...citation,
    })),
  };
}

export function buildGoldenEvidenceBrief(item: GoldenCase): EvidenceBriefViewModel {
  const priceFinding = finding(item, "FND-PRICE-001");
  const documentFinding = finding(item, "FND-DOC-001");
  const graphFinding = finding(item, "FND-GRAPH-001");
  const openFindings = item.findings.filter((candidate) => candidate.status === "OPEN");
  const abstentions = item.findings.filter((candidate) => candidate.status === "ABSTAINED");

  const modules = (["PRICE", "DOCUMENT", "GRAPH"] as const).map((engine) => ({
    engine,
    ...moduleConfiguration[engine],
    status: "SCORED" as const,
    finding_count: openFindings.filter((candidate) => candidate.module === engine).length,
  }));

  return {
    projection_version: "saring-evidence-brief-ui-1.0.0",
    source_contract_versions: ["saring-evidence-brief-1.0.0", "saring-engine-result-1.0.0"],
    brief_id: "BRIEF-AR-2026-001",
    brief_version: "1.0.0",
    package_id: item.id,
    package_name: item.name,
    run_id: "AR-2026-001",
    analysis_cutoff_at: item.analysisCutoffAt,
    workflow_stage: "PRE_AWARD",
    status: "READY_FOR_REVIEW",
    review_priority: "HIGH",
    narrative: "Tiga mesin menemukan sinyal yang saling melengkapi pada posisi harga, kemiripan dokumen non-template, dan pola co-bidding historis. Temuan ini menentukan urutan pemeriksaan dan tidak membuktikan pelanggaran.",
    evidence_completeness: item.evidenceCompleteness / 100,
    finding_count: openFindings.length,
    source_citation_count: item.findings.reduce((total, current) => total + current.citations.length, 0),
    abstention_count: abstentions.length,
    modules,
    price: {
      ...findingView(priceFinding, "PRICE"),
      metrics: {
        item_id: "LAPTOP-BISNIS-16-512",
        quantity: 3_000,
        q50: 11_200_000,
        q90: 12_600_000,
        hps_unit: 13_200_000,
        quoted_unit: 14_500_000,
        relative_deviation: 0.151,
        exposure: 5_700_000_000,
      },
    },
    document: {
      ...findingView(documentFinding, "DOCUMENT"),
      metrics: {
        vendor_left: "PT Fajar Perangkat Negeri",
        vendor_right: "PT Garuda Data Solusi",
        similarity: 0.91,
        template_excluded: true,
        rare_shared_errors: 1,
        passage_left: documentFinding.citations[0]?.excerpt ?? "",
        passage_right: documentFinding.citations[1]?.excerpt ?? "",
      },
    },
    graph: {
      ...findingView(graphFinding, "GRAPH"),
      metrics: {
        vendor_ids: ["SYN-V003", "SYN-V006", "SYN-V007"],
        vendor_labels: ["Cakrawala Piranti", "Fajar Perangkat", "Garuda Data"],
        historical_co_bids: 11,
        award_rotations: 2,
        cutoff_compatible: true,
      },
    },
    limitations: [
      "Satu field garansi memiliki extraction confidence rendah dan dikeluarkan dari scoring.",
      "Data beneficial ownership resmi belum tersedia pada snapshot graph saat ini.",
      "Exposure harga merupakan estimasi untuk review, bukan perhitungan kerugian negara.",
    ],
    recommended_review_actions: [
      { code: "CLARIFICATION_REQUESTED", label: "Konfirmasi komponen layanan dan garansi pada penawaran Vendor 03." },
      { code: "CONFIRMED_FOR_FOLLOW_UP", label: "Minta penjelasan sumber passage yang sama dari Vendor 06 dan Vendor 07." },
      { code: "EXTRACTION_CORRECTION", label: "Verifikasi field garansi low-confidence dari dokumen sumber." },
      { code: "ENTITY_CORRECTION", label: "Periksa dated co-bidding path tanpa mengasumsikan koordinasi." },
    ],
    provenance: {
      audit_log_ref: "AUDIT-BRIEF-AR-2026-001",
      renderer: "DETERMINISTIC_TEMPLATE",
      factuality_status: "VERIFIED",
      created_at: "2025-09-19T18:02:17+07:00",
      model_versions: item.engines.map((engine) => ({ label: engine.label, value: engine.modelVersion })),
    },
  };
}
