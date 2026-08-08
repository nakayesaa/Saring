import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisFindingsOverview } from "@/components/analysis-findings-overview";
import { buildGoldenAnalysisFindings, projectAnalysisFindings } from "@/lib/analysis-findings";
import { getLatestAnalysisResults } from "@/lib/analysis/service";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { getGoldenCase, goldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Temuan analisis" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function AnalysisFindingsPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  let analysis;
  try {
    const persisted = await getLatestAnalysisResults(principal, packageId);
    analysis = projectAnalysisFindings(persisted);
  } catch (error) {
    const item = getGoldenCase(packageId);
    if (!(error instanceof DomainError && error.code === "JOB_NOT_FOUND") || !item) notFound();
    analysis = buildGoldenAnalysisFindings(item);
  }
  return <AnalysisFindingsOverview analysis={analysis} />;
}
