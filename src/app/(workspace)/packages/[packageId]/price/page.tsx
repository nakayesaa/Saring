import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisModuleDetail } from "@/components/analysis-module-detail";
import { buildGoldenAnalysisFindings, projectAnalysisFindings } from "@/lib/analysis-findings";
import { getLatestAnalysisResults } from "@/lib/analysis/service";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { getGoldenCase, goldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Price Evidence" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function PriceEvidencePage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  let analysis;
  try {
    analysis = projectAnalysisFindings(await getLatestAnalysisResults(principal, packageId));
  } catch (error) {
    const item = getGoldenCase(packageId);
    if (!(error instanceof DomainError && error.code === "JOB_NOT_FOUND") || !item) notFound();
    analysis = buildGoldenAnalysisFindings(item);
  }
  const engineModule = analysis.modules.find(({ engine }) => engine === "PRICE");
  if (!engineModule) notFound();

  return (
    <AnalysisModuleDetail
      packageId={analysis.package_id}
      packageName={analysis.package_name}
      title="Price Engine"
      description="Tinjau posisi harga, batas pembanding, bukti, dan penjelasan alternatif. Sinyal ini bukan putusan fraud."
      module={engineModule}
    />
  );
}
