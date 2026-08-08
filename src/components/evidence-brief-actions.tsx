"use client";

import { Download } from "lucide-react";

export function EvidenceBriefActions() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#a9d500] bg-[#c7ff00] px-5 text-base font-extrabold text-[#0b1b43] transition hover:bg-[#b9ee00] print:hidden"
    >
      <Download size={18} aria-hidden="true" /> Export PDF
    </button>
  );
}
