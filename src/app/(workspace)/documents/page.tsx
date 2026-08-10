import type { Metadata } from "next";
import { Upload } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";

export const metadata: Metadata = { title: "Documents" };
export default function DocumentsPage() {
  return <><PageHeading eyebrow="Evidence library" title="Documents" description="Indeks dokumen lintas-package aktual belum diimplementasikan. Dokumen hasil ingestion dapat ditinjau dari package masing-masing; halaman ini tidak menampilkan fixture." actions={<PrimaryActionLink href="/packages"><Upload size={16} /> Open packages</PrimaryActionLink>} /><div className="shell-page-content"><p className="mt-6 rounded-xl border border-[#292b30] bg-[#0f1011] p-8 text-[#9da2ab]">Pilih package aktual untuk membuka bukti dan source locator-nya.</p></div></>;
}
