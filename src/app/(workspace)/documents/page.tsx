import type { Metadata } from "next";
import { FileCheck2, FileSearch, ScanLine, Upload } from "lucide-react";

import { DocumentsLibrary } from "@/components/documents-library";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { RaisedIcon } from "@/components/raised-icon";
import { demoDocuments, documentMetrics } from "@/lib/fixtures/workspace";

export const metadata: Metadata = { title: "Documents" };

const metricIcons = {
  files: FileSearch,
  validated: FileCheck2,
  ocr: ScanLine,
} as const;

export default function DocumentsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Evidence library"
        title="Documents"
        description="Original evidence remains immutable. Extraction, OCR, classification, and page-level locators are tracked as reproducible processing layers."
        actions={
          <PrimaryActionLink href="/packages/new">
            <Upload size={16} strokeWidth={2.1} /> Upload bundle
          </PrimaryActionLink>
        }
      />

      <div className="shell-page-content">
        <section className="mt-5 grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-2 lg:grid-cols-4">
          {documentMetrics.map(({ label, value, detail, icon }) => {
            const MetricIcon = metricIcons[icon];
            return (
              <article key={label} className="top-edge-highlight bg-[#0f1011] p-4">
                <div className="flex items-center justify-between"><p className="text-sm font-medium text-[#686d76]">{label}</p><RaisedIcon><MetricIcon size={18} strokeWidth={2} /></RaisedIcon></div>
                <p className="mt-4 text-xl font-semibold tracking-[-0.5px]">{value}</p>
                <p className="mt-1 text-sm text-[#50545c]">{detail}</p>
              </article>
            );
          })}
        </section>

        <DocumentsLibrary documents={demoDocuments} />
      </div>
    </>
  );
}
