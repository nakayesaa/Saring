import type { Metadata } from "next";
import { goldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Detail dokumen" };

export function generateStaticParams() {
  return [{ packageId: goldenCase.id }];
}

export default function DocumentDetailPlaceholder() {
  return null;
}
