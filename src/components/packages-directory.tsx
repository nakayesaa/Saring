"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, FileCheck2, FlaskConical } from "lucide-react";

import { PriorityLabel } from "@/components/priority-label";
import { ProgressBar } from "@/components/progress-bar";
import { RaisedIcon } from "@/components/raised-icon";
import { WorkspaceFilterMenu, WorkspaceSearch, WorkspaceTabs, type WorkspaceOption } from "@/components/workspace-controls";
import type { DemoPackage, PackagePriority } from "@/lib/fixtures/workspace";
import { useRowSelection } from "@/lib/hooks/use-row-selection";

type PackageScope = "all" | "active" | "needs-evidence" | "reference";
type PriorityScope = "all" | PackagePriority;

const packageTabs: readonly WorkspaceOption<PackageScope>[] = [
  { label: "All", value: "all" },
  { label: "Active review", value: "active" },
  { label: "Needs evidence", value: "needs-evidence" },
  { label: "Reference", value: "reference" },
];

const priorityOptions: readonly WorkspaceOption<PriorityScope>[] = [
  { label: "All priorities", value: "all" },
  { label: "Critical", value: "Critical" },
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Reference", value: "Reference" },
];

function PackageName({ item }: { item: DemoPackage }) {
  const className = "block max-w-[310px] truncate text-base font-medium text-[#dfe1e5] group-hover:text-white";
  return item.href ? <Link href={item.href} className={className}>{item.name}</Link> : <span className={className}>{item.name}</span>;
}

export function PackagesDirectory({ packages }: { packages: readonly DemoPackage[] }) {
  const [scope, setScope] = useState<PackageScope>("all");
  const [priority, setPriority] = useState<PriorityScope>("all");
  const [query, setQuery] = useState("");
  const [recentFirst, setRecentFirst] = useState(true);
  const selection = useRowSelection();

  const visiblePackages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = packages.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.id, item.name, item.buyer, item.method].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesScope =
        scope === "all" ||
        (scope === "active" && (item.stage === "In review" || item.stage === "Ready")) ||
        (scope === "needs-evidence" && item.stage === "Needs evidence") ||
        (scope === "reference" && item.priority === "Reference");
      return matchesQuery && matchesScope && (priority === "all" || item.priority === priority);
    });

    return recentFirst ? filtered : [...filtered].reverse();
  }, [packages, priority, query, recentFirst, scope]);

  const visibleIds = visiblePackages.map(({ id }) => id);
  const allVisibleSelected = selection.allSelected(visibleIds);

  return (
    <>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <WorkspaceTabs options={packageTabs} value={scope} onChange={setScope} />
        <div className="flex items-center gap-2">
          <WorkspaceFilterMenu label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
          <button
            type="button"
            onClick={() => setRecentFirst((current) => !current)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#292b30] bg-[#0f1011] px-2.5 text-base text-[#777c85] hover:border-[#3a3d43] hover:text-[#c7cad0]"
            aria-label={`Sort packages ${recentFirst ? "oldest first" : "newest first"}`}
          >
            <ArrowUpDown size={12} aria-hidden="true" /> Updated
          </button>
          <WorkspaceSearch label="Search packages" placeholder="Search packages…" value={query} onChange={setQuery} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{visiblePackages.length} packages shown</p>
      <section className="app-panel top-edge-highlight mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#23252a] bg-[#0c0d0e] text-sm font-medium uppercase tracking-[0.07em] text-[#555a63]">
                <th className="w-10 px-4 py-2.5"><input aria-label="Select all visible packages" type="checkbox" checked={allVisibleSelected} onChange={() => selection.toggleAll(visibleIds)} className="accent-[#5e6ad2]" /></th>
                <th className="px-3 py-2.5">Package</th><th className="px-3 py-2.5">Buyer / method</th><th className="px-3 py-2.5">Value</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Evidence</th><th className="px-3 py-2.5">Stage</th>
              </tr>
            </thead>
            <tbody>
              {visiblePackages.map((item) => (
                <tr key={item.id} className="row-hover group border-b border-[#1c1e22] last:border-0 hover:bg-[#131416]">
                  <td className="px-4 py-3.5"><input aria-label={`Select ${item.name}`} type="checkbox" checked={selection.isSelected(item.id)} onChange={() => selection.toggle(item.id)} className="accent-[#5e6ad2]" /></td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-3"><RaisedIcon>{item.synthetic ? <FlaskConical size={18} strokeWidth={2} /> : <FileCheck2 size={18} strokeWidth={2} />}</RaisedIcon><div><PackageName item={item} /><p className="mt-1 font-mono text-sm text-[#555a63]">{item.id}</p></div></div>
                  </td>
                  <td className="px-3 py-3.5"><p className="text-base text-[#9da2ab]">{item.buyer}</p><p className="mt-1 text-sm text-[#555a63]">{item.method}</p></td>
                  <td className="px-3 py-3.5 font-mono text-base text-[#9da2ab]">{item.value}</td>
                  <td className="px-3 py-3.5"><PriorityLabel priority={item.priority} /></td>
                  <td className="w-36 px-3 py-3.5"><div className="flex items-center gap-2"><ProgressBar value={item.completeness} tone={item.completeness > 90 ? "success" : "accent"} /><span className="font-mono text-sm text-[#5f646c]">{item.completeness}%</span></div></td>
                  <td className="px-3 py-3.5"><p className="text-base text-[#858a93]">{item.stage}</p><p className="mt-1 text-sm text-[#4f535b]">{item.updated}</p></td>
                </tr>
              ))}
              {visiblePackages.length === 0 ? <tr><td colSpan={7} className="px-6 py-14 text-center text-base text-[#647493]">No packages match the current filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#202226] bg-[#0c0d0e] px-4 py-2.5 text-sm text-[#555a63]">
          <span>{visiblePackages.length} of {packages.length} packages</span>
          {selection.count > 0 ? <span>{selection.count} selected</span> : null}
        </div>
      </section>
    </>
  );
}
