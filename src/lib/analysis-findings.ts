import type { AnalysisEngine } from "@/lib/analysis-progress";
import type { GeneralEngineResult } from "@/lib/analysis/contracts";
import type { GoldenCase, GoldenFinding } from "@/lib/golden-case";
import { GOLDEN_PACKAGE_ID } from "@/lib/demo-ids";

export type EngineResultStatus = "SCORED" | "LOW_CONFIDENCE" | "ABSTAINED" | "NOT_APPLICABLE";
export type FindingScope = "PACKAGE" | "VENDOR" | "CROSS_VENDOR" | "ITEM";

export type AnalysisEvidenceLocatorView = {
  locator_id: string;
  label: string;
  source: string;
  locator: string;
  excerpt: string;
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
  source_contract_versions: readonly ("saring-engine-result-1.0.0" | "saring-evidence-brief-1.0.0")[];
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
  modules: AnalysisModuleView[];
  abstentions: AnalysisAbstentionView[];
};

const primaryEngines = ["PRICE", "DOCUMENT", "GRAPH"] as const;

function readableFindingType(value: string) {
  return value.toLowerCase().split("_").map((part) =>
    part ? part[0].toUpperCase() + part.slice(1) : part,
  ).join(" ");
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
  if (!metrics) return "Evidence-linked signal";
  const preferred = metrics.display_metric;
  if (typeof preferred === "string" || typeof preferred === "number") return String(preferred);
  const entry = Object.entries(metrics).find(([, value]) => value !== null);
  return entry ? `${readableFindingType(entry[0])}: ${String(entry[1])}` : "Evidence-linked signal";
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
      summary: result?.summary ?? "No result was returned for this engine.",
      findings: (result?.findings ?? []).map((finding) => ({
        finding_id: finding.finding_id,
        finding_type: finding.finding_type,
        scope: finding.scope,
        subject_ids: finding.subject_ids,
        score: finding.score,
        confidence: finding.confidence,
        title: readableFindingType(finding.finding_type),
        summary: finding.summary,
        metric: displayMetric(finding.metrics),
        evidence_locator_ids: finding.evidence_locator_ids,
        evidence_locators: finding.evidence_locator_ids.flatMap((id) => {
          const locator = locators.get(id);
          return locator ? [{
            locator_id: locator.locator_id,
            label: locator.label ?? readableFindingType(locator.source_type),
            source: locatorSource(locator),
            locator: locatorPosition(locator),
            excerpt: locator.excerpt ?? "Open the cited source to verify this signal.",
          }] : [];
        }),
        alternative_explanations: finding.alternative_explanations,
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
      evidence_locator: locator ? {
        locator_id: locator.locator_id,
        label: locator.label ?? readableFindingType(locator.source_type),
        source: locatorSource(locator),
        locator: locatorPosition(locator),
        excerpt: locator.excerpt ?? result.summary,
      } : {
        locator_id: `ABSTENTION:${result.result_id}`,
        label: `${readableFindingType(result.engine)} abstention`,
        source: result.engine_version,
        locator: result.result_id,
        excerpt: result.summary,
      },
    }];
  });
  const scores = modules.flatMap((module) => module.findings.map((finding) => finding.score ?? 0));
  const highestScore = Math.max(0, ...scores);
  const findingCount = modules.reduce((total, module) => total + module.findings.length, 0);
  const reviewPriority = findingCount === 0
    ? abstentions.length ? "INSUFFICIENT_DATA" : "NO_SIGNIFICANT_ALERT"
    : highestScore >= 0.7 ? "HIGH" : highestScore >= 0.4 ? "MEDIUM" : "LOW";

  return {
    projection_version: "saring-analysis-findings-ui-1.0.0",
    source_contract_versions: ["saring-engine-result-1.0.0"],
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
    modules,
    abstentions,
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
    label: citation.label,
    source: citation.source,
    locator: citation.locator,
    excerpt: citation.excerpt,
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
          label: locator?.label ?? "Low-confidence extraction",
          source: locator?.source ?? "canonical extraction",
          locator: locator?.locator ?? finding.id,
          excerpt: locator?.excerpt ?? finding.alternativeExplanation,
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
    modules,
    abstentions,
  };
}
