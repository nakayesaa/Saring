import "server-only";

import { contentHash } from "@/lib/price-engine/adapter";
import type { AnalysisJobContract, GeneralEngineResult } from "@/lib/analysis/contracts";
import type { AnalysisEngine } from "@/lib/analysis-progress";
import { getGoldenCase, type GoldenFinding } from "@/lib/golden-case";
import { parseEngineResult } from "@/lib/price-engine/validation";

const severityScore = { LOW: 0.2, MEDIUM: 0.45, HIGH: 0.75, CRITICAL: 0.95 } as const;

function resultForFindings(
  job: AnalysisJobContract,
  engine: AnalysisEngine,
  findings: GoldenFinding[],
  analysisCutoffAt: string,
): GeneralEngineResult {
  const activeFindings = findings.filter(({ status }) => status === "OPEN");
  const locators = activeFindings.flatMap((finding) =>
    finding.citations.map((citation, index) => ({
      schema_version: "saring-evidence-locator-1.0.0" as const,
      locator_id: `${finding.id}:LOC:${index + 1}`,
      package_id: job.package_id,
      source_type: "EXTERNAL_RECORD" as const,
      source_hash: contentHash(citation),
      source_system: "SARING_FIXTURE",
      source_record_id: citation.source,
      excerpt: citation.excerpt,
      label: `${citation.label} · ${citation.locator}`,
    })),
  );
  const status = activeFindings.length ? "SCORED" : findings.length ? "ABSTAINED" : "NOT_APPLICABLE";
  const top = [...activeFindings].sort(
    (left, right) => severityScore[right.severity] - severityScore[left.severity] || right.confidence - left.confidence,
  )[0];
  const createdAt = new Date(Date.parse(job.created_at) + 10_000).toISOString();

  return parseEngineResult({
    schema_version: "saring-engine-result-2.0.0",
    result_id: `RESULT:${job.run_id}:${engine}`,
    run_id: job.run_id,
    package_id: job.package_id,
    analysis_cutoff_at: analysisCutoffAt,
    engine,
    engine_version: `fixture-${engine.toLowerCase()}-1.0.0`,
    model_version: null,
    status,
    score: top ? severityScore[top.severity] : null,
    confidence: top?.confidence ?? null,
    summary: activeFindings.length
      ? `${activeFindings.length} source-linked ${engine.toLowerCase()} finding${activeFindings.length === 1 ? "" : "s"} require human review.`
      : `The fixture produced no positive ${engine.toLowerCase()} evidence for this package.`,
    findings: activeFindings.map((finding) => ({
      finding_id: finding.id,
      finding_type: `${engine}_REVIEW_SIGNAL`,
      scope: engine === "DOCUMENT" || engine === "GRAPH" ? "CROSS_VENDOR" : "PACKAGE",
      subject_ids: [job.package_id],
      score: severityScore[finding.severity],
      confidence: finding.confidence,
      summary: finding.summary,
      evidence_locator_ids: finding.citations.map((_, index) => `${finding.id}:LOC:${index + 1}`),
      alternative_explanations: [finding.alternativeExplanation],
      metrics: { display_metric: finding.metric },
    })),
    evidence_locators: locators,
    alternative_explanations: [...new Set(findings.map(({ alternativeExplanation }) => alternativeExplanation))],
    abstention_reason: status === "SCORED" ? null : status === "ABSTAINED"
      ? "The available fixture evidence requires abstention."
      : "No deterministic fixture result is defined for this supporting engine.",
    input_snapshot_hash: job.canonical_snapshot_hash,
    created_at: createdAt,
  });
}

export function buildFixtureEngineResults(
  job: AnalysisJobContract,
  analysisCutoffAt: string,
) {
  const golden = getGoldenCase(job.package_id);
  return job.requested_engines.map((engine) => {
    const findings = golden?.findings.filter(({ module }) => module === engine) ?? [];
    return resultForFindings(job, engine, findings, analysisCutoffAt);
  });
}
