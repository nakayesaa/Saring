import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceBriefView } from "@/components/evidence-brief-view";
import { buildGoldenEvidenceBrief } from "@/lib/evidence-brief";
import { getGoldenCase, goldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Evidence Brief" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function EvidenceBriefPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const item = getGoldenCase(packageId);
  if (!item) notFound();

  return <EvidenceBriefView brief={buildGoldenEvidenceBrief(item)} />;
}
