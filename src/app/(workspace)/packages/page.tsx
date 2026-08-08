import type { Metadata } from "next";
import { Archive, FileCheck2, FolderPlus } from "lucide-react";

import { PackagesDirectory } from "@/components/packages-directory";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { RaisedIcon } from "@/components/raised-icon";
import { demoPackages, packageSummaryMetrics } from "@/lib/fixtures/workspace";

export const metadata: Metadata = { title: "Packages" };

const summaryIcons = {
  active: FolderPlus,
  archived: Archive,
  contract: FileCheck2,
} as const;

export default function PackagesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Case management"
        title="Packages"
        description="Every procurement review lives in a persistent package workspace with documents, actors, findings, decisions, and an immutable source trail."
        actions={<PrimaryActionLink href="/packages/new"><FolderPlus size={17} /> Add package</PrimaryActionLink>}
      />

      <div className="shell-page-content">
        <PackagesDirectory packages={demoPackages} />

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          {packageSummaryMetrics.map(({ title, detail, value, icon }) => {
            const Icon = summaryIcons[icon];
            return (
              <article key={title} className="app-panel top-edge-highlight p-4">
                <div className="flex items-center justify-between"><RaisedIcon><Icon size={18} strokeWidth={2} /></RaisedIcon><span className="font-mono text-lg text-[#c7cad0]">{value}</span></div>
                <h2 className="mt-4 text-base font-medium text-[#b7bbc3]">{title}</h2>
                <p className="mt-1 text-sm text-[#555a63]">{detail}</p>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
