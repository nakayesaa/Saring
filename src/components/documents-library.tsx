"use client";

import { useMemo, useState } from "react";
import { FileSearch } from "lucide-react";

import { DotLabel, type DotTone } from "@/components/dot-label";
import { RaisedIcon } from "@/components/raised-icon";
import { WorkspaceFilterMenu, WorkspaceSearch, WorkspaceTabs, type WorkspaceOption } from "@/components/workspace-controls";
import type { DemoDocument } from "@/lib/fixtures/workspace";
import { useRowSelection } from "@/lib/hooks/use-row-selection";

type DocumentScope = "all" | "review" | "restricted" | "synthetic";

const documentTabs: { label: string; value: DocumentScope }[] = [
  { label: "All files", value: "all" },
  { label: "Needs review", value: "review" },
  { label: "Restricted", value: "restricted" },
  { label: "Synthetic", value: "synthetic" },
];

type ExtractionScope = "all" | DemoDocument["extraction"];

const extractionOptions: readonly WorkspaceOption<ExtractionScope>[] = [
  { label: "All extraction", value: "all" },
  { label: "Validated", value: "Validated" },
  { label: "Verified", value: "Verified" },
  { label: "Parsed", value: "Parsed" },
  { label: "OCR review", value: "OCR review" },
  { label: "Queued", value: "Queued" },
];

const statusTone: Record<DemoDocument["extraction"] | DemoDocument["classification"], DotTone> = {
  Validated: "success",
  Verified: "success",
  Parsed: "info",
  "OCR review": "warning",
  Queued: "neutral",
  Restricted: "restricted",
  Synthetic: "info",
};

export function DocumentsLibrary({ documents }: { documents: readonly DemoDocument[] }) {
  const [scope, setScope] = useState<DocumentScope>("all");
  const [extraction, setExtraction] = useState<ExtractionScope>("all");
  const [query, setQuery] = useState("");
  const selection = useRowSelection();

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesQuery =
        !normalizedQuery ||
        document.name.toLowerCase().includes(normalizedQuery) ||
        document.type.toLowerCase().includes(normalizedQuery) ||
        document.packageId.toLowerCase().includes(normalizedQuery);
      const matchesScope =
        scope === "all" ||
        (scope === "review" && document.extraction === "OCR review") ||
        (scope === "restricted" && document.classification === "Restricted") ||
        (scope === "synthetic" && document.classification === "Synthetic");
      const matchesExtraction =
        extraction === "all" || document.extraction === extraction;

      return matchesQuery && matchesScope && matchesExtraction;
    });
  }, [documents, extraction, query, scope]);

  const visibleNames = visibleDocuments.map(({ name }) => name);
  const allVisibleSelected = selection.allSelected(visibleNames);

  return (
    <>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <WorkspaceTabs options={documentTabs} value={scope} onChange={setScope} />

        <div className="flex items-center gap-2">
          <WorkspaceFilterMenu label="Filter" options={extractionOptions} value={extraction} onChange={setExtraction} />
          <WorkspaceSearch label="Search documents" placeholder="Search files…" value={query} onChange={setQuery} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{visibleDocuments.length} documents shown</p>
      <section className="app-panel top-edge-highlight mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[930px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#23252a] bg-[#0c0d0e] text-sm font-medium uppercase tracking-[0.07em] text-[#555a63]">
                <th className="w-10 px-4 py-2.5"><input aria-label="Select all visible documents" type="checkbox" checked={allVisibleSelected} onChange={() => selection.toggleAll(visibleNames)} className="accent-[#5e6ad2]" /></th>
                <th className="px-3 py-2.5">File</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Package</th><th className="px-3 py-2.5">Pages</th><th className="px-3 py-2.5">Extraction</th><th className="px-3 py-2.5">Class</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((document) => (
                <tr key={document.name} className="row-hover group border-b border-[#1c1e22] last:border-0 hover:bg-[#131416]">
                  <td className="px-4 py-3"><input aria-label={`Select ${document.name}`} type="checkbox" checked={selection.isSelected(document.name)} onChange={() => selection.toggle(document.name)} className="accent-[#5e6ad2]" /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5"><RaisedIcon><FileSearch size={18} strokeWidth={2} /></RaisedIcon><div><p className="max-w-[280px] truncate font-mono text-sm text-[#c7cad0] group-hover:text-white">{document.name}</p><p className="mt-1 text-sm text-[#4f535b]">SHA-256 verified · {document.updated}</p></div></div>
                  </td>
                  <td className="px-3 py-3 text-base text-[#8f949d]">{document.type}</td>
                  <td className="px-3 py-3 font-mono text-sm text-[#62666d]">{document.packageId}</td>
                  <td className="px-3 py-3 font-mono text-sm text-[#858a93]">{document.pages}</td>
                  <td className="px-3 py-3"><DotLabel tone={statusTone[document.extraction]}>{document.extraction}</DotLabel></td>
                  <td className="px-3 py-3"><DotLabel tone={statusTone[document.classification]}>{document.classification}</DotLabel></td>
                </tr>
              ))}
              {visibleDocuments.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-14 text-center text-base text-[#647493]">No documents match the current filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#202226] bg-[#0c0d0e] px-4 py-2.5 text-sm text-[#555a63]"><span>Showing {visibleDocuments.length} of {documents.length} files</span><span>{selection.count > 0 ? `${selection.count} selected` : "Raw originals are immutable"}</span></div>
      </section>
    </>
  );
}
