"use client";

import {
  ArrowRight,
  BadgeDollarSign,
  Check,
  ClipboardList,
  Database,
  FileText,
  ListChecks,
  Save,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  ExtractionCategoryKey,
  ExtractionReviewViewModel,
} from "@/lib/extraction-review";

const categoryIcons = {
  overview: ClipboardList,
  requirements: ListChecks,
  pricing: BadgeDollarSign,
  vendors: UsersRound,
  metadata: Database,
};

export function ExtractionReviewPanel({ review }: { review: ExtractionReviewViewModel }) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ExtractionCategoryKey>("vendors");
  const [selectedFieldId, setSelectedFieldId] = useState("vendor-14-warranty");
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [draftValue, setDraftValue] = useState("3 years");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const allFields = useMemo(
    () => review.categories.flatMap((category) => category.fields),
    [review.categories],
  );
  const category = review.categories.find((item) => item.key === activeCategory) ?? review.categories[0];
  const selectedField = allFields.find((field) => field.id === selectedFieldId) ?? category.fields[0];
  const pendingFields = allFields.filter(
    (field) => field.status === "NEEDS_REVIEW" && !corrections[field.id],
  );
  const canRunAnalysis = pendingFields.length === 0;

  function selectCategory(key: ExtractionCategoryKey) {
    const nextCategory = review.categories.find((item) => item.key === key);
    if (!nextCategory) return;
    setActiveCategory(key);
    setSelectedFieldId(nextCategory.fields[0]?.id ?? "");
  }

  function saveCorrection() {
    const value = draftValue.trim();
    if (!value || selectedField.status !== "NEEDS_REVIEW") return;
    setCorrections((current) => ({ ...current, [selectedField.id]: value }));
  }

  async function startAnalysis() {
    if (!canRunAnalysis || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(review.packageId)}/analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Analysis could not be started.");
      router.push(`/packages/${review.packageId}/processing`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Analysis could not be started.");
      setIsStarting(false);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="extraction-review-title">
      <div>
        <h2 id="extraction-review-title" className="text-2xl font-extrabold text-[#17191d]">Extraction review</h2>
        <p className="mt-1 text-base font-medium text-[#647493]">Confirm canonical fields against their source before SARING runs analysis.</p>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border-2 border-[#9fa6b2] bg-white shadow-[0_24px_52px_-26px_rgb(11_27_67_/_48%),0_10px_22px_-16px_rgb(11_27_67_/_32%),0_2px_6px_-2px_rgb(11_27_67_/_18%)]">
        <div className="grid min-h-[590px] xl:grid-cols-[230px_minmax(0,1fr)_340px]">
          <nav className="border-b border-[#e5e6e8] bg-[#f7f7f6] p-4 xl:border-b-0 xl:border-r" aria-label="Extraction categories">
            <p className="px-3 pb-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[#77869f]">Extracted fields</p>
            <div className="space-y-1">
              {review.categories.map((item) => {
                const Icon = categoryIcons[item.key];
                const active = item.key === activeCategory;
                const pending = item.fields.filter((field) => field.status === "NEEDS_REVIEW" && !corrections[field.id]).length;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectCategory(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? "bg-[#0b1b43] text-white" : "text-[#2d3f66] hover:bg-[#ececeb]"}`}
                  >
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm font-bold">{item.label}</span>
                    {pending > 0 ? <span className="grid size-6 place-items-center rounded-full bg-[#c7ff00] text-xs font-black text-[#0b1b43]">{pending}</span> : null}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0 border-b border-[#e5e6e8] xl:border-b-0 xl:border-r">
            <header className="border-b border-[#e5e6e8] px-6 py-5">
              <h2 className="text-xl font-extrabold text-[#17191d]">{category.label}</h2>
              <p className="mt-1 text-sm font-medium text-[#647493]">{category.description}</p>
            </header>
            <div className="divide-y divide-[#ececeb]">
              {category.fields.map((field) => {
                const active = field.id === selectedField.id;
                const corrected = corrections[field.id];
                const requiresReview = field.status === "NEEDS_REVIEW" && !corrected;
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`flex w-full items-center gap-4 px-6 py-4 text-left transition ${active ? "bg-[#f3f6ff]" : "hover:bg-[#fafafa]"}`}
                  >
                    <span className={`h-10 w-1 shrink-0 rounded-full ${requiresReview ? "bg-[#c7ff00]" : active ? "bg-[#1450e6]" : "bg-transparent"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-[0.06em] text-[#77869f]">{field.label}</span>
                      <span className="mt-1 block truncate text-base font-bold text-[#17191d]">{corrected ?? field.value}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-extrabold ${requiresReview ? "text-[#a56800]" : "text-[#168b55]"}`}>
                      {requiresReview ? `${Math.round(field.confidence * 100)}% · Review` : corrected ? "Corrected" : "Verified"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="bg-[#fafafa] p-6">
            <div className="flex items-center gap-2 text-[#17191d]"><FileText size={22} strokeWidth={2.1} /><h2 className="text-lg font-extrabold">Source context</h2></div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-bold text-[#77869f]">Source</dt><dd className="mt-1 break-words font-bold text-[#17191d]">{selectedField.source}</dd></div>
              <div><dt className="font-bold text-[#77869f]">Locator</dt><dd className="mt-1 font-semibold text-[#2d3f66]">{selectedField.locator}</dd></div>
              <div><dt className="font-bold text-[#77869f]">Extraction confidence</dt><dd className="mt-1 font-mono font-extrabold text-[#17191d]">{Math.round(selectedField.confidence * 100)}%</dd></div>
            </dl>

            <div className="mt-5 rounded-lg bg-[#fff9e8] px-4 py-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-[#77869f]">Source excerpt</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#2d3f66]">“{selectedField.excerpt}”</p>
            </div>

            {selectedField.status === "NEEDS_REVIEW" ? (
              <div className="mt-6">
                <label htmlFor="corrected-value" className="text-sm font-extrabold text-[#17191d]">Corrected canonical value</label>
                <input
                  id="corrected-value"
                  value={corrections[selectedField.id] ?? draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  disabled={Boolean(corrections[selectedField.id])}
                  className="mt-2 h-12 w-full rounded-lg border-2 border-[#b8bbc2] bg-white px-4 text-base font-bold text-[#17191d] outline-none focus:border-[#1450e6] disabled:bg-[#eef0f3]"
                />
                {corrections[selectedField.id] ? (
                  <p className="mt-3 flex items-center gap-2 text-sm font-extrabold text-[#168b55]"><Check size={18} /> Correction recorded with reviewer provenance</p>
                ) : (
                  <button type="button" onClick={saveCorrection} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#17191d] px-4 text-sm font-extrabold text-white transition hover:bg-black">
                    <Save size={17} /> Save correction
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-6 flex items-center gap-2 text-sm font-extrabold text-[#168b55]">Source and canonical value agree</p>
            )}
          </aside>
        </div>
      </section>

      <div className="mt-6 flex flex-col items-end gap-2">
        <button
          type="button"
          disabled={!canRunAnalysis || isStarting}
          onClick={startAnalysis}
          aria-busy={isStarting}
          className={`pending-action flex h-12 shrink-0 items-center justify-center rounded-lg border border-[#a9d500] bg-[#c7ff00] px-6 text-base font-extrabold text-[#0b1b43] shadow-[0_5px_12px_-7px_rgb(11_27_67_/_55%)] transition hover:bg-[#b9ee00] disabled:cursor-not-allowed ${!canRunAnalysis && !isStarting ? "opacity-45 shadow-none" : ""}`}
        >
          <span className="pending-action-content grid items-center">
            <span aria-hidden={isStarting} className={`[grid-area:1/1] inline-flex items-center justify-center gap-2 transition-opacity duration-150 ${isStarting ? "opacity-0" : "opacity-100"}`}>Run analysis <ArrowRight size={17} aria-hidden="true" /></span>
            <span aria-hidden={!isStarting} className={`[grid-area:1/1] transition-opacity duration-150 ${isStarting ? "opacity-100" : "opacity-0"}`}>Preparing analysis…</span>
          </span>
        </button>
        {startError ? <p role="alert" className="text-sm font-bold text-[#b42318]">{startError}</p> : null}
      </div>
    </section>
  );
}
