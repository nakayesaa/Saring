import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";

export const metadata: Metadata = { title: "Vendors & actors" };
export default function EntitiesPage() {
  return <><PageHeading eyebrow="Institutional memory" title="Vendors & actors" description="Direktori aktor lintas-package aktual belum diimplementasikan; fixture vendor telah dinonaktifkan." actions={<PrimaryActionLink href="/packages"><Network size={16} /> Open packages</PrimaryActionLink>} /><div className="shell-page-content"><p className="mt-6 rounded-xl border border-[#292b30] bg-[#0f1011] p-8 text-[#9da2ab]">Buka detail Graph Engine pada package untuk melihat entitas dan relasi dari run aktual.</p></div></>;
}
