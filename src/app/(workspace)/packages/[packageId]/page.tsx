import { redirect } from "next/navigation";

export default async function PackageEntryPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  redirect(`/packages/${packageId}/findings`);
}
