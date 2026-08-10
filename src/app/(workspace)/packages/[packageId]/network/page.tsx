import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisModuleDetail } from "@/components/analysis-module-detail";
import { GraphNetworkPanel } from "@/components/graph-network-panel";
import { getAnalysisFindingsView } from "@/lib/analysis/findings-query";

export const metadata: Metadata = { title: "Detail relasi" };

export default async function RelationshipDetailPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const analysis = await getAnalysisFindingsView(packageId);
  if (!analysis) notFound();
  const engineModule = analysis.modules.find(({ engine }) => engine === "GRAPH");
  if (!engineModule) notFound();

  return (
    <>
      <AnalysisModuleDetail
        packageId={analysis.package_id}
        packageName={analysis.package_name}
        title="Graph Engine"
        description="Tinjau pola partisipasi bersama dan evidence trail. Hubungan statistik bukan bukti koordinasi atau afiliasi."
        module={engineModule}
        visualization={<GraphNetworkPanel module={engineModule} />}
      />
    </>
  );
}
