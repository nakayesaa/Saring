import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActualEvidenceBriefView } from "@/components/actual-evidence-brief-view";
import { getAnalysisFindingsView } from "@/lib/analysis/findings-query";

export const metadata: Metadata = { title: "Evidence Brief" };

export default async function EvidenceBriefPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const analysis = await getAnalysisFindingsView(packageId);
  if (!analysis) notFound();
  return <ActualEvidenceBriefView analysis={analysis} />;
}
