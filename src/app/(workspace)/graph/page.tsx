import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";

export const metadata: Metadata = { title: "Graph Relasi Vendor | SARING" };
export default function GraphPage() {
  return <><PageHeading eyebrow="Relationship graph" title="Relationship graph" description="Graf global fixture telah dinonaktifkan. Visualisasi aktual tersedia pada detail Graph Engine untuk setiap package yang selesai dianalisis." actions={<PrimaryActionLink href="/packages">Open packages</PrimaryActionLink>} /><div className="shell-page-content"><p className="mt-6 rounded-xl border border-[#292b30] bg-[#0f1011] p-8 text-[#9da2ab]">Pilih package, buka Temuan Analisis, lalu pilih bagian Relasi.</p></div></>;
}
