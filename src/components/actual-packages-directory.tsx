import Link from "next/link";
import { FlaskConical, FolderOpen } from "lucide-react";
import type { StoredPackageOption } from "@/lib/intake/library";

export function ActualPackagesDirectory({ packages }: { packages: StoredPackageOption[] }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#292b30] bg-[#0f1011]">
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left">
        <thead><tr className="border-b border-[#292b30] text-xs uppercase tracking-wide text-[#777c85]"><th className="px-5 py-3">Package</th><th className="px-4 py-3">Buyer / method</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Updated</th></tr></thead>
        <tbody>
          {packages.map((item) => <tr key={item.id} className="border-b border-[#23252a] last:border-0">
            <td className="px-5 py-4"><Link href={`/packages/${item.id}/${item.stage === "INGESTING" || item.stage === "VALIDATING" ? "ingestion" : item.stage === "READY_FOR_ANALYSIS" ? "readiness" : "findings"}`} className="font-bold text-[#dfe1e5] hover:text-white">{item.name}</Link><p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[#777c85]">{item.synthetic ? <FlaskConical size={13} /> : <FolderOpen size={13} />}{item.sourceId}</p></td>
            <td className="px-4 py-4 text-sm text-[#9da2ab]">{item.buyer}<span className="mt-1 block text-xs text-[#777c85]">{item.method}</span></td>
            <td className="px-4 py-4 text-sm text-[#9da2ab]">{item.documentCount} dokumen · {item.participantCount} vendor · {item.findingCount} temuan</td>
            <td className="px-4 py-4 font-mono text-xs text-[#9da2ab]">{item.stage}</td>
            <td className="px-4 py-4 font-mono text-xs text-[#777c85]">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(item.updatedAt))}</td>
          </tr>)}
          {packages.length === 0 && <tr><td colSpan={5} className="px-6 py-14 text-center text-[#777c85]">Belum ada package aktual di workspace ini.</td></tr>}
        </tbody>
      </table></div>
      <p className="border-t border-[#292b30] px-5 py-3 text-xs font-bold text-[#777c85]">{packages.length} package dari database workspace · tidak memakai fixture</p>
    </section>
  );
}
