import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisFindingsOverview } from "@/components/analysis-findings-overview";
import { getAnalysisFindingsView } from "@/lib/analysis/findings-query";

export const metadata: Metadata = { title: "Temuan analisis" };

export default async function AnalysisFindingsPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const analysis = await getAnalysisFindingsView(packageId);
  if (!analysis) notFound();
  return <AnalysisFindingsOverview analysis={analysis} />;
}
