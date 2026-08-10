import type { AnalysisEngine } from "@/lib/analysis-progress";
import type { GeneralEngineResult } from "@/lib/analysis/contracts";
import type { GoldenCase, GoldenFinding } from "@/lib/golden-case";
import { GOLDEN_PACKAGE_ID } from "@/lib/demo-ids";

export type EngineResultStatus = "SCORED" | "LOW_CONFIDENCE" | "ABSTAINED" | "NOT_APPLICABLE";
export type FindingScope = "PACKAGE" | "VENDOR" | "CROSS_VENDOR" | "ITEM";

export type AnalysisEvidenceLocatorView = {
  locator_id: string;
  source_type: GeneralEngineResult["evidence_locators"][number]["source_type"];
  label: string;
  source: string;
  locator: string;
  excerpt: string;
  document_id: string | null;
  page_number: number | null;
  bbox: [number, number, number, number] | null;
};

export type AnalysisFindingView = {
  finding_id: string;
  finding_type: string;
  scope: FindingScope;
  subject_ids: string[];
  score: number | null;
  confidence: number;
  title: string;
  summary: string;
  metric: string;
  metrics: Record<string, string | number | boolean | null>;
  evidence_locator_ids: string[];
  evidence_locators: AnalysisEvidenceLocatorView[];
  alternative_explanations: string[];
};

export type AnalysisModuleView = {
  result_id: string;
  engine: Extract<AnalysisEngine, "PRICE" | "DOCUMENT" | "GRAPH">;
  engine_version: string;
  model_version: string | null;
  status: EngineResultStatus;
  score: number | null;
  confidence: number | null;
  summary: string;
  findings: AnalysisFindingView[];
};

export type AnalysisAbstentionView = {
  module: AnalysisEngine;
  subject_id: string;
  reason: string;
  evidence_locator: AnalysisEvidenceLocatorView;
};

export type AnalysisFindingsViewModel = {
  projection_version: "saring-analysis-findings-ui-1.0.0";
  source_contract_versions: readonly ("saring-engine-result-1.0.0" | "saring-engine-result-2.0.0" | "saring-evidence-brief-1.0.0")[];
  brief_id: string;
  brief_version: string;
  package_id: string;
  package_name: string;
  run_id: string;
  analysis_cutoff_at: string;
  workflow_stage: "PRE_AWARD";
  status: "READY_FOR_REVIEW";
  review_priority: "HIGH" | "MEDIUM" | "LOW" | "NO_SIGNIFICANT_ALERT" | "INSUFFICIENT_DATA";
  finding_count: number;
  source_citation_count: number;
  abstention_count: number;
  fusion: {
    model_version: "confidence-aware-evidence-fusion-1.0.0";
    review_priority_index: number;
    evidence_confidence: number;
    available_module_count: number;
    corroborating_module_count: number;
    dominant_module: "PRICE" | "DOCUMENT" | "GRAPH" | null;
    contributions: Record<"PRICE" | "DOCUMENT" | "GRAPH" | "CROSS_MODAL", number>;
  };
  modules: AnalysisModuleView[];
  abstentions: AnalysisAbstentionView[];
};

const primaryEngines = ["PRICE", "DOCUMENT", "GRAPH"] as const;

export const findingPresentation = {
  PRICE_ABOVE_MARKET_RANGE: {
    label: "Harga di atas rentang pasar",
    description: "Harga yang diperiksa melampaui rentang pasar pembanding dan perlu diverifikasi terhadap ruang lingkup penawaran.",
  },
  PRICE_BELOW_MARKET_RANGE: {
    label: "Harga di bawah rentang pasar",
    description: "Harga yang diperiksa berada di bawah rentang pasar pembanding dan perlu diverifikasi terhadap kelengkapan penawaran.",
  },
  HPS_ABOVE_MARKET_RANGE: {
    label: "HPS di atas rentang pasar",
    description: "HPS melampaui rentang pasar pembanding dan perlu diperiksa dasar penyusunannya.",
  },
  PRICE_ABOVE_UPPER_BOUND: {
    label: "Harga di atas batas pembanding",
    description: "Harga yang diperiksa berada di atas rentang kelompok barang sebanding dan perlu dikonfirmasi terhadap ruang lingkup penawaran.",
  },
  REPEATED_CO_BIDDING: {
    label: "Partisipasi bersama berulang",
    description: "Pasangan vendor muncul bersama lebih sering daripada ambang pola historis pembanding.",
  },
  CROSS_DOCUMENT_FACT_CONTRADICTION: {
    label: "Kontradiksi fakta lintas dokumen",
    description: "Dua dokumen vendor memuat nilai yang tidak konsisten dan perlu dibandingkan oleh reviewer.",
  },
  RARE_TEXT_OVERLAP: {
    label: "Kemiripan teks tidak lazim",
    description: "Passage non-template yang serupa ditemukan pada dokumen berbeda dan perlu ditelusuri ke sumbernya.",
  },
} as const;

const translations: Record<string, string> = {
  "The normalized target value falls outside the disclosed conditional price interval and requires human verification; this is not a fraud conclusion.": "Harga yang telah dinormalisasi berada di luar rentang pasar pembanding. Reviewer perlu memeriksa kesetaraan spesifikasi, layanan, pajak, dan syarat pengiriman; temuan ini bukan kesimpulan fraud.",
  "This vendor pair co-participated more often than expected from each vendor's own activity within the same opportunity set. The FDR-controlled signal requires corroboration and is not a collusion conclusion.": "Pasangan vendor ini mengikuti tender bersama lebih sering daripada yang diperkirakan berdasarkan aktivitas masing-masing pada kelompok peluang yang sama. Sinyal yang telah dikendalikan terhadap temuan semu ini memerlukan bukti pendukung dan bukan kesimpulan kolusi.",
  "The evaluated unit price is above the empirical conditional range for its disclosed comparator cohort and requires human verification; it is not a fraud conclusion. This is a synthetic functional signal.": "Harga satuan berada di atas rentang empiris kelompok barang sebanding. Reviewer perlu memeriksa perbedaan spesifikasi, layanan, pajak, dan syarat pengiriman; sinyal ini bukan kesimpulan fraud.",
  "This vendor pair co-participated more often than the configured empirical reference percentile. The synthetic pattern requires corroboration and is not a collusion conclusion.": "Pasangan vendor ini mengikuti tender bersama lebih sering daripada ambang persentil historis yang digunakan. Pola tersebut perlu diperkuat dengan bukti lain dan bukan kesimpulan kolusi.",
  "The target includes a longer warranty or a service component absent from comparators.": "Penawaran dapat mencakup garansi lebih panjang atau layanan yang tidak terdapat pada data pembanding.",
  "Tax, shipping, installation, or delivery terms may not be fully reconciled.": "Pajak, pengiriman, instalasi, atau syarat serah terima mungkin belum sepenuhnya disetarakan.",
  "The target specification may contain a higher-quality component not represented in canonical fields.": "Spesifikasi dapat memuat komponen dengan mutu lebih tinggi yang belum tercatat pada field canonical.",
  "The comparator cohort may not reflect a recent regional market shift.": "Kelompok pembanding mungkin belum menangkap perubahan harga pasar regional terbaru.",
  "A low quote may reflect a promotion, different unit basis, omitted scope, or non-comparable specification.": "Perbedaan harga dapat disebabkan promosi, basis satuan berbeda, ruang lingkup yang tidak lengkap, atau spesifikasi yang tidak benar-benar sebanding.",
  "A small or specialized market can make repeated co-bidding normal.": "Pasar yang kecil atau khusus dapat membuat vendor yang sama sering mengikuti tender bersama secara wajar.",
  "Geographic coverage, product authorization, or qualification rules may limit suppliers.": "Cakupan wilayah, otorisasi produk, atau persyaratan kualifikasi dapat membatasi jumlah pemasok.",
  "The available history may omit tenders where only one member of the pair participated.": "Riwayat yang tersedia mungkin belum mencakup tender ketika hanya salah satu vendor berpartisipasi.",
  "Common participation does not establish communication or coordinated bidding.": "Partisipasi bersama tidak membuktikan komunikasi ataupun koordinasi penawaran.",
  "Shared consultant or document preparer.": "Kedua vendor mungkin menggunakan konsultan atau penyusun dokumen yang sama.",
  "Legitimate manufacturer or distributor material.": "Teks dapat berasal dari materi resmi produsen atau distributor yang sama.",
  "Required or customary wording not captured by the template profile.": "Teks dapat merupakan redaksi wajib atau lazim yang belum tercakup dalam profil template.",
  "Extraction or OCR artifact.": "Kemiripan dapat dipengaruhi kesalahan ekstraksi atau OCR.",
  "Coincidence in a small technical vocabulary.": "Kemiripan dapat terjadi karena kosakata teknis yang terbatas.",
  "Price value under review": "Harga yang diperiksa",
  "Cutoff-safe comparator cohort": "Kelompok pembanding sebelum cutoff",
  "Canonical item context": "Konteks barang canonical",
  "Rare shared text for reviewer verification": "Teks langka yang sama untuk diverifikasi reviewer",
  "Dated historical participation edge": "Riwayat partisipasi tender bertanggal",
  "Eligible Indonesian comparator observation": "Data harga pembanding Indonesia yang memenuhi kriteria",
  "Canonical price target": "Harga penawaran yang dianalisis",
};

export function translateAnalysisText(value: string) {
  const translated = translations[value];
  if (translated) return translated;
  const participation = value.match(/^(\S+) participated in (\S+) on (\d{4}-\d{2}-\d{2})$/);
  if (participation) return `${participation[1]} berpartisipasi dalam ${participation[2]} pada ${participation[3]}`;
  const evaluatedValue = value.match(/^Evaluated value: ([\d.]+)$/);
  if (evaluatedValue) return `Harga yang dievaluasi: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(evaluatedValue[1]))}`;
  if (value.startsWith("Comparator IDs:")) return value.replace("Comparator IDs:", "ID data pembanding:");
  if (/^Synthetic benchmark: found \d+ price position signal/.test(value)) return "Ditemukan posisi harga di atas kelompok pembanding yang memerlukan verifikasi ruang lingkup dan kewajaran harga.";
  if (/^Synthetic benchmark: found \d+ repeated co-bidding outlier/.test(value)) return "Ditemukan pola partisipasi bersama berulang yang melampaui ambang historis pembanding dan memerlukan pemeriksaan lanjutan.";
  if (/^Found \d+ rare cross-vendor text overlap signal/.test(value)) return "Ditemukan kemiripan teks non-template lintas vendor yang perlu diverifikasi asal dokumennya.";
  if (/^Scored \d+ target\(s\) against normalized Indonesian price observations; \d+ review signal\(s\) were published\.$/.test(value)) return "Penawaran telah dibandingkan dengan data harga Indonesia yang dinormalisasi; posisi harga di luar rentang pasar diterbitkan untuk pemeriksaan reviewer.";
  if (/^Screened \d+ vendor pair\(s\) across \d+ controlled historical package\(s\); published \d+ activity-normalized co-bidding signal\(s\)\.$/.test(value)) return "Pasangan vendor telah diperiksa pada paket historis yang sebanding; pola partisipasi bersama yang tidak lazim diterbitkan untuk pemeriksaan reviewer.";
  return value;
}

export function readableFindingType(value: string) {
  const presentation = findingPresentation[value as keyof typeof findingPresentation];
  if (presentation) return presentation.label;
  return value.toLowerCase().split("_").map((part) =>
    part ? part[0].toUpperCase() + part.slice(1) : part,
  ).join(" ");
}

function projectLocator(locator: GeneralEngineResult["evidence_locators"][number]): AnalysisEvidenceLocatorView {
  return {
    locator_id: locator.locator_id,
    source_type: locator.source_type,
    label: translateAnalysisText(locator.label ?? readableFindingType(locator.source_type)),
    source: locatorSource(locator),
    locator: locatorPosition(locator),
    excerpt: translateAnalysisText(locator.excerpt ?? "Buka sumber yang dirujuk untuk memverifikasi temuan ini."),
    document_id: locator.document_id ?? null,
    page_number: locator.page_number ?? null,
    bbox: locator.bbox ?? null,
  };
}

function locatorSource(locator: GeneralEngineResult["evidence_locators"][number]) {
  return locator.document_id ?? locator.source_record_id ?? locator.record_id ??
    locator.graph_edge_id ?? locator.source_system ?? locator.source_type;
}

function locatorPosition(locator: GeneralEngineResult["evidence_locators"][number]) {
  if (locator.page_number) return `Page ${locator.page_number}`;
  if (locator.json_path) return locator.json_path;
  if (locator.table_name) return [locator.table_name, locator.row_key, locator.column_name].filter(Boolean).join(" · ");
  return locator.label ?? locator.source_type;
}

function displayMetric(metrics: Record<string, string | number | boolean | null> | undefined) {
  if (!metrics) return "Sinyal berbasis bukti";
  if (typeof metrics.quoted_or_hps_value === "number" && typeof metrics.q90 === "number") {
    return `${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(metrics.quoted_or_hps_value)} vs Q90 ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(metrics.q90)}`;
  }
  if (typeof metrics.co_bid_count === "number") return `${metrics.co_bid_count} tender bersama`;
  if (typeof metrics.normalized_similarity === "number") return `${Math.round(metrics.normalized_similarity * 100)}% kemiripan`;
  const preferred = metrics.display_metric;
  if (typeof preferred === "string" || typeof preferred === "number") return String(preferred);
  const entry = Object.entries(metrics).find(([, value]) => value !== null);
  return entry ? `${readableFindingType(entry[0])}: ${String(entry[1])}` : "Sinyal berbasis bukti";
}

export function projectAnalysisFindings(input: {
  packageId: string;
  packageName: string;
  runId: string;
  analysisCutoffAt: string;
  results: GeneralEngineResult[];
}): AnalysisFindingsViewModel {
  const resultByEngine = new Map(input.results.map((result) => [result.engine, result]));
  const modules = primaryEngines.map((engine): AnalysisModuleView => {
    const result = resultByEngine.get(engine);
    const locators = new Map(result?.evidence_locators.map((locator) => [locator.locator_id, locator]));
    return {
      result_id: result?.result_id ?? `MISSING:${input.runId}:${engine}`,
      engine,
      engine_version: result?.engine_version ?? "unavailable",
      model_version: result?.model_version ?? null,
      status: result?.status ?? "NOT_APPLICABLE",
      score: result?.score ?? null,
      confidence: result?.confidence ?? null,
      summary: translateAnalysisText(result?.summary ?? "Mesin tidak mengembalikan hasil."),
      findings: (result?.findings ?? []).map((finding) => ({
        finding_id: finding.finding_id,
        finding_type: finding.finding_type,
        scope: finding.scope,
        subject_ids: finding.subject_ids,
        score: finding.score,
        confidence: finding.confidence,
        title: readableFindingType(finding.finding_type),
        summary: translateAnalysisText(finding.summary),
        metric: displayMetric(finding.metrics),
        metrics: finding.metrics ?? {},
        evidence_locator_ids: finding.evidence_locator_ids,
        evidence_locators: finding.evidence_locator_ids.flatMap((id) => {
          const locator = locators.get(id);
          return locator ? [projectLocator(locator)] : [];
        }),
        alternative_explanations: finding.alternative_explanations.map(translateAnalysisText),
      })),
    };
  });
  const abstentions = input.results.flatMap((result): AnalysisAbstentionView[] => {
    if (result.status !== "ABSTAINED") return [];
    const locator = result.evidence_locators[0];
    return [{
      module: result.engine,
      subject_id: input.packageId,
      reason: result.abstention_reason ?? result.summary,
      evidence_locator: locator ? projectLocator(locator) : {
        locator_id: `ABSTENTION:${result.result_id}`,
        source_type: "JSON_PATH",
        label: `${readableFindingType(result.engine)} abstention`,
        source: result.engine_version,
        locator: result.result_id,
        excerpt: result.summary,
        document_id: null,
        page_number: null,
        bbox: null,
      },
    }];
  });
  const findingCount = modules.reduce((total, module) => total + module.findings.length, 0);
  const fusion = fuseModuleEvidence(modules);
  const reviewPriority = findingCount === 0
    ? abstentions.length ? "INSUFFICIENT_DATA" : "NO_SIGNIFICANT_ALERT"
    : fusion.review_priority_index >= 65 && fusion.corroborating_module_count >= 2
      ? "HIGH"
      : fusion.review_priority_index >= 40 ? "MEDIUM" : "LOW";

  return {
    projection_version: "saring-analysis-findings-ui-1.0.0",
    source_contract_versions: ["saring-engine-result-2.0.0"],
    brief_id: `BRIEF:${input.runId}`,
    brief_version: "1.0.0",
    package_id: input.packageId,
    package_name: input.packageName,
    run_id: input.runId,
    analysis_cutoff_at: input.analysisCutoffAt,
    workflow_stage: "PRE_AWARD",
    status: "READY_FOR_REVIEW",
    review_priority: reviewPriority,
    finding_count: findingCount,
    source_citation_count: modules.reduce((total, module) => total + module.findings.reduce((sum, finding) => sum + finding.evidence_locators.length, 0), 0),
    abstention_count: abstentions.length,
    fusion,
    modules,
    abstentions,
  };
}

function fuseModuleEvidence(modules: AnalysisModuleView[]): AnalysisFindingsViewModel["fusion"] {
  const policyWeights = { PRICE: 0.35, DOCUMENT: 0.35, GRAPH: 0.30 } as const;
  const active = modules.filter((module) =>
    module.status !== "ABSTAINED" && module.status !== "NOT_APPLICABLE" && module.score !== null,
  );
  const weighted = active.map((module) => {
    const confidence = Math.max(0, Math.min(1, module.confidence ?? 0));
    const severity = Math.max(0, Math.min(1, module.score ?? 0));
    const effectiveWeight = policyWeights[module.engine] * (0.5 + 0.5 * confidence);
    return { engine: module.engine, confidence, effectiveWeight, evidence: severity * effectiveWeight };
  });
  const denominator = weighted.reduce((sum, item) => sum + item.effectiveWeight, 0);
  const baseScore = denominator
    ? weighted.reduce((sum, item) => sum + item.evidence, 0) / denominator
    : 0;
  const corroborating = active.filter((module) =>
    module.findings.length > 0 && (module.score ?? 0) >= 0.55,
  ).length;
  const corroborationBonus = corroborating >= 3 ? 0.18 : corroborating === 2 ? 0.10 : 0;
  const contributions = {
    PRICE: 0,
    DOCUMENT: 0,
    GRAPH: 0,
    CROSS_MODAL: corroborationBonus,
  };
  for (const item of weighted) contributions[item.engine] = denominator ? item.evidence / denominator : 0;
  const dominant = weighted.length
    ? weighted.reduce((best, item) => item.evidence > best.evidence ? item : best).engine
    : null;
  const meanConfidence = weighted.length
    ? weighted.reduce((sum, item) => sum + item.confidence, 0) / weighted.length
    : 0;
  const coverageFactor = 0.6 + 0.4 * active.length / 3;
  return {
    model_version: "confidence-aware-evidence-fusion-1.0.0",
    review_priority_index: Math.round(Math.min(1, baseScore + corroborationBonus) * 100),
    evidence_confidence: Math.round(meanConfidence * coverageFactor * 100) / 100,
    available_module_count: active.length,
    corroborating_module_count: corroborating,
    dominant_module: dominant,
    contributions,
  };
}

const moduleConfiguration: Record<
  AnalysisModuleView["engine"],
  Pick<AnalysisModuleView, "engine_version" | "model_version" | "score" | "confidence">
> = {
  PRICE: {
    engine_version: "price-engine-1.0.0",
    model_version: "price-qreg-demo-1.0",
    score: 0.84,
    confidence: 0.87,
  },
  DOCUMENT: {
    engine_version: "document-engine-1.0.0",
    model_version: "document-evidence-demo-1.0",
    score: 0.79,
    confidence: 0.82,
  },
  GRAPH: {
    engine_version: "graph-engine-1.0.0",
    model_version: "graph-motif-demo-1.0",
    score: 0.71,
    confidence: 0.74,
  },
};

function findingScope(finding: GoldenFinding): FindingScope {
  if (finding.module === "PRICE") return finding.id === "FND-PRICE-002" ? "PACKAGE" : "ITEM";
  if (finding.module === "DOCUMENT") return finding.id === "FND-DOC-001" ? "CROSS_VENDOR" : "VENDOR";
  if (finding.module === "GRAPH") return "CROSS_VENDOR";
  return "PACKAGE";
}

function findingSubjects(finding: GoldenFinding) {
  if (finding.id === "FND-PRICE-001") return ["SYN-V003", "LAPTOP-BISNIS-16-512"];
  if (finding.id === "FND-PRICE-002") return [GOLDEN_PACKAGE_ID];
  if (finding.id === "FND-PRICE-003") return ["SYN-V011", "SYN-V015"];
  if (finding.id === "FND-DOC-001") return ["SYN-V006", "SYN-V007"];
  if (finding.id === "FND-DOC-002") return ["SYN-V014"];
  if (finding.id === "FND-GRAPH-001") return ["SYN-V003", "SYN-V006", "SYN-V007"];
  return [];
}

function toFindingView(finding: GoldenFinding): AnalysisFindingView {
  const evidenceLocators = finding.citations.map((citation, index) => ({
    locator_id: `LOC-${finding.id}-${index + 1}`,
    source_type: "DOCUMENT_REGION" as const,
    label: citation.label,
    source: citation.source,
    locator: citation.locator,
    excerpt: citation.excerpt,
    document_id: citation.source,
    page_number: null,
    bbox: null,
  }));

  return {
    finding_id: finding.id,
    finding_type: finding.id.replace(/^FND-/, "").replace(/-\d+$/, ""),
    scope: findingScope(finding),
    subject_ids: findingSubjects(finding),
    score: finding.status === "ABSTAINED" ? null : finding.confidence,
    confidence: finding.confidence,
    title: finding.title,
    summary: finding.summary,
    metric: finding.metric,
    metrics: {},
    evidence_locator_ids: evidenceLocators.map((locator) => locator.locator_id),
    evidence_locators: evidenceLocators,
    alternative_explanations: [finding.alternativeExplanation],
  };
}

export function buildGoldenAnalysisFindings(item: GoldenCase): AnalysisFindingsViewModel {
  const engines: AnalysisModuleView["engine"][] = ["PRICE", "DOCUMENT", "GRAPH"];
  const modules = engines.map((engine): AnalysisModuleView => {
    const engineRun = item.engines.find((candidate) => candidate.key === engine.toLowerCase());
    const findings = item.findings
      .filter((finding) => finding.module === engine && finding.status === "OPEN")
      .map(toFindingView);
    const configuration = moduleConfiguration[engine];

    return {
      result_id: `RESULT-AR-2026-001-${engine}`,
      engine,
      ...configuration,
      status: "SCORED",
      summary: engineRun?.summary ?? "Hasil mesin tersedia untuk human review.",
      findings,
    };
  });
  const abstentions = item.findings
    .filter((finding) => finding.status === "ABSTAINED")
    .map((finding): AnalysisAbstentionView => {
      const locator = finding.citations[0];
      return {
        module: "DATA_QUALITY",
        subject_id: findingSubjects(finding)[0] ?? item.id,
        reason: finding.summary,
        evidence_locator: {
          locator_id: `LOC-${finding.id}-1`,
          source_type: "JSON_PATH",
          label: locator?.label ?? "Low-confidence extraction",
          source: locator?.source ?? "canonical extraction",
          locator: locator?.locator ?? finding.id,
          excerpt: locator?.excerpt ?? finding.alternativeExplanation,
          document_id: null,
          page_number: null,
          bbox: null,
        },
      };
    });

  return {
    projection_version: "saring-analysis-findings-ui-1.0.0",
    source_contract_versions: ["saring-engine-result-1.0.0", "saring-evidence-brief-1.0.0"],
    brief_id: "BRIEF-AR-2026-001",
    brief_version: "1.0.0",
    package_id: item.id,
    package_name: item.name,
    run_id: "AR-2026-001",
    analysis_cutoff_at: item.analysisCutoffAt,
    workflow_stage: "PRE_AWARD",
    status: "READY_FOR_REVIEW",
    review_priority: "HIGH",
    finding_count: modules.reduce((total, module) => total + module.findings.length, 0),
    source_citation_count: item.findings.reduce((total, finding) => total + finding.citations.length, 0),
    abstention_count: abstentions.length,
    fusion: fuseModuleEvidence(modules),
    modules,
    abstentions,
  };
}
