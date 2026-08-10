import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisModuleDetail } from "@/components/analysis-module-detail";
import { getAnalysisFindingsView } from "@/lib/analysis/findings-query";

export const metadata: Metadata = { title: "Price Evidence" };

export default async function PriceEvidencePage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const analysis = await getAnalysisFindingsView(packageId);
  if (!analysis) notFound();
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
