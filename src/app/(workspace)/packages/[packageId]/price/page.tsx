import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceEvidenceView } from "@/components/price-evidence-view";
import { getGoldenCase, goldenCase } from "@/lib/golden-case";
import { buildPriceEvidenceViewModel } from "@/lib/price-evidence";
import { getPriceEvidenceQuery } from "@/lib/price-engine/service";

export const metadata: Metadata = { title: "Price Evidence" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function PriceEvidencePage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const item = getGoldenCase(packageId);
  if (!item) notFound();
  const response = await getPriceEvidenceQuery().getByPackageId(packageId);

  return <PriceEvidenceView evidence={buildPriceEvidenceViewModel(response, item.name)} />;
}
