"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Building2, Landmark, UsersRound } from "lucide-react";

import { DotLabel } from "@/components/dot-label";
import { RaisedIcon } from "@/components/raised-icon";
import { WorkspaceFilterMenu, WorkspaceSearch, WorkspaceTabs } from "@/components/workspace-controls";
import type { DemoEntity } from "@/lib/fixtures/workspace";

type EntityScope = "all" | "vendors" | "buyers" | "review";
type VerificationScope = "all" | "verified" | "source-matched";

const entityTabs: { label: string; value: EntityScope }[] = [
  { label: "All entities", value: "all" },
  { label: "Vendors", value: "vendors" },
  { label: "Buyers", value: "buyers" },
  { label: "Needs review", value: "review" },
];

const verificationOptions: { label: string; value: VerificationScope }[] = [
  { label: "All verification", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Source matched", value: "source-matched" },
];

export function EntitiesDirectory({ entities }: { entities: readonly DemoEntity[] }) {
  const [scope, setScope] = useState<EntityScope>("all");
  const [verification, setVerification] = useState<VerificationScope>("all");
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(true);

  const visibleEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entities
      .filter((entity) => {
        const matchesQuery =
          !normalizedQuery ||
          entity.name.toLowerCase().includes(normalizedQuery) ||
          entity.kind.toLowerCase().includes(normalizedQuery);
        const matchesScope =
          scope === "all" ||
          (scope === "vendors" && entity.kind === "Vendor") ||
          (scope === "buyers" && entity.kind === "Buyer") ||
          (scope === "review" && entity.verification === "Source matched");
        const matchesVerification =
          verification === "all" ||
          (verification === "verified" && entity.verification === "Verified") ||
          (verification === "source-matched" && entity.verification === "Source matched");

        return matchesQuery && matchesScope && matchesVerification;
      })
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, "id");
        return ascending ? comparison : -comparison;
      });
  }, [ascending, entities, query, scope, verification]);

  return (
    <section className="mt-5">
      <div className="app-panel top-edge-highlight overflow-visible">
        <div className="flex flex-col gap-3 border-b border-[#23252a] p-3 sm:flex-row sm:items-center sm:justify-between">
          <WorkspaceTabs options={entityTabs} value={scope} onChange={setScope} />

          <div className="flex items-center gap-2">
            <WorkspaceFilterMenu label="Filter entity verification" options={verificationOptions} value={verification} onChange={setVerification} compact />

            <button
              type="button"
              onClick={() => setAscending((value) => !value)}
              className="grid size-8 place-items-center rounded-md border border-[#292b30] bg-[#0f1011] text-[#686d76] hover:text-[#c7cad0]"
              aria-label={`Sort entities ${ascending ? "descending" : "ascending"}`}
            >
              <ArrowUpDown size={12} />
            </button>

            <WorkspaceSearch label="Search entities" placeholder="Search entities…" value={query} onChange={setQuery} />
          </div>
        </div>

        <p className="sr-only" aria-live="polite">{visibleEntities.length} entities shown</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#23252a] bg-[#0c0d0e] text-sm font-medium uppercase tracking-[0.07em] text-[#555a63]">
                <th className="px-4 py-2.5">Entity</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Tenders</th><th className="px-3 py-2.5">Wins</th><th className="px-3 py-2.5">Edges</th><th className="px-3 py-2.5">Verification</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntities.map((entity) => (
                <tr key={entity.name} className="row-hover group border-b border-[#1c1e22] last:border-0 hover:bg-[#131416]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5"><RaisedIcon>{entity.kind === "Vendor" ? <Building2 size={18} strokeWidth={2} /> : <Landmark size={18} strokeWidth={2} />}</RaisedIcon><div><p className="max-w-[250px] truncate text-base font-medium text-[#cfd2d7] group-hover:text-white">{entity.name}</p><p className="mt-1 text-sm text-[#4f535b]">Last seen {entity.lastSeen}</p></div></div>
                  </td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1.5 text-sm text-[#777c85]">{entity.kind === "Vendor" ? <Building2 size={11} /> : <UsersRound size={11} />}{entity.kind}</div></td>
                  <td className="px-3 py-3 font-mono text-sm text-[#858a93]">{entity.tenders}</td>
                  <td className="px-3 py-3 font-mono text-sm text-[#858a93]">{entity.kind === "Buyer" ? "—" : entity.wins}</td>
                  <td className="px-3 py-3 font-mono text-sm text-[#858a93]">{entity.links}</td>
                  <td className="px-3 py-3"><DotLabel tone={entity.verification === "Verified" ? "success" : "info"}>{entity.verification}</DotLabel></td>
                </tr>
              ))}
              {visibleEntities.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-14 text-center text-base text-[#647493]">No entities match the current filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
