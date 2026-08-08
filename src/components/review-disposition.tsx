"use client";

import { useState } from "react";
import { CheckCircle2, CircleHelp, Flag, MessageSquareText } from "lucide-react";

const actions = [
  { key: "follow_up", label: "Tindak lanjut", icon: CheckCircle2 },
  { key: "clarification", label: "Minta klarifikasi", icon: CircleHelp },
  { key: "benign", label: "Penjelasan diterima", icon: CheckCircle2 },
  { key: "escalated", label: "Eskalasi ke APIP", icon: Flag },
] as const;

export function ReviewDisposition() {
  const [selected, setSelected] = useState<(typeof actions)[number]["key"] | null>(null);

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${selected === key ? "border-[#1450e6] bg-[#eef3ff] text-[#1450e6]" : "border-[#d7d9dd] bg-white text-[#526383] hover:border-[#b8bbc2] hover:bg-[#f5f5f4]"}`}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="flex items-center gap-2 text-xs font-bold text-[#77869f]"><MessageSquareText size={15} /> Catatan reviewer</span>
        <textarea rows={4} placeholder="Tambahkan alasan keputusan…" className="mt-2 w-full resize-none rounded-lg border border-[#d7d9dd] bg-white p-3 text-sm font-medium text-[#0b1b43] outline-none placeholder:text-[#8a98b0] focus:border-[#1450e6] focus:ring-2 focus:ring-[#1450e6]/15" />
      </label>
      <button type="button" disabled={!selected} className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-[#c7ff00] px-5 text-sm font-extrabold text-[#0b1b43] transition hover:bg-[#b9ee00] disabled:cursor-not-allowed disabled:opacity-45">
        Simpan keputusan
      </button>
      {selected ? <p className="mt-3 text-center text-xs font-semibold text-[#647493]">Demo: {actions.find((action) => action.key === selected)?.label}. Belum ada write ke backend.</p> : null}
    </div>
  );
}
