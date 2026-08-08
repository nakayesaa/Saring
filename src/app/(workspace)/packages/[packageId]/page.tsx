import { redirect } from "next/navigation";
import { goldenCase } from "@/lib/golden-case";

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default async function PackageEntryPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  redirect(`/packages/${packageId}/findings`);
}
