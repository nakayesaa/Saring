import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEvidenceView } from "@/components/document-evidence-view";
import { getAnalysisFindingsView } from "@/lib/analysis/findings-query";
import { goldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Detail dokumen" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const analysis = await getAnalysisFindingsView(packageId);
  const documentModule = analysis?.modules.find((module) => module.engine === "DOCUMENT");
  if (!analysis || !documentModule) notFound();

  return (
    <DocumentEvidenceView
      packageId={analysis.package_id}
      packageName={analysis.package_name}
      runId={analysis.run_id}
      cutoff={analysis.analysis_cutoff_at}
      module={documentModule}
    />
  );
}
