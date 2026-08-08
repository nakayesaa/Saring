"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReadinessCheck } from "@/lib/readiness";

function CoverageMeter({ value }: { value: number }) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className="w-full min-w-[140px] max-w-[160px]"
      role="progressbar"
      aria-label={`${normalizedValue}% coverage`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedValue}
    >
      <div className="flex items-end justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#77869f]">Coverage</span>
        <span className="font-mono text-lg font-bold leading-none tracking-[-0.03em] text-[#0b1b43]">
          {normalizedValue}<span className="ml-0.5 text-xs text-[#647493]">%</span>
        </span>
      </div>
      <svg className="mt-3 block h-1.5 w-full" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="6" rx="3" fill="#e5e6e8" />
        <rect width={normalizedValue} height="6" rx="3" fill="#c7ff00" />
      </svg>
    </div>
  );
}

export function ReadinessEngineList({ checks }: { checks: readonly ReadinessCheck[] }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedCheck = checks.find((check) => check.label === selectedLabel) ?? null;

  useEffect(() => {
    if (!selectedCheck) return;
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedLabel(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedCheck]);

  return (
    <>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((check) => (
          <article key={check.label} className="flex min-w-0 flex-col rounded-xl border border-[#d7d9dd] bg-white p-4 transition hover:border-[#aeb3bc]">
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-[#17191d]">{check.label}</h3>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-5 text-[#647493]">{check.detail}</p>
            </div>
            <div className="mt-4">
              <CoverageMeter value={check.value} />
            </div>
            <div className="mt-3 flex justify-end border-t border-[#ececeb] pt-3">
              <button type="button" onClick={() => setSelectedLabel(check.label)} className="text-xs font-extrabold text-[#17191d] underline-offset-4 hover:underline">
                View details
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedCheck ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-5 backdrop-blur-[2px]" role="presentation" onMouseDown={() => setSelectedLabel(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="readiness-detail-title"
            className="w-full max-w-xl rounded-2xl border-2 border-[#8f9aad] bg-white shadow-[0_30px_80px_-25px_rgb(5_18_48_/_70%)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-5 border-b border-[#e5e6e8] px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#647493]">{selectedCheck.status}</p>
                <h2 id="readiness-detail-title" className="mt-2 text-2xl font-extrabold text-[#17191d]">{selectedCheck.label}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#647493]">{selectedCheck.detail}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setSelectedLabel(null)} aria-label="Close readiness details" className="grid size-10 shrink-0 place-items-center rounded-full text-[#647493] transition hover:bg-[#eef0f3] hover:text-[#17191d]">
                <X size={22} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </header>

            <div className="px-6 py-6">
              <CoverageMeter value={selectedCheck.value} />
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="border-l-4 border-[#c7ff00] bg-[#f7f8fa] px-4 py-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#77869f]">Why this status</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#2d3f66]">{selectedCheck.explanation}</p>
                </div>
                <div className="border-l-4 border-[#1450e6] bg-[#f7f8fa] px-4 py-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#77869f]">Analysis behavior</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#2d3f66]">{selectedCheck.consequence}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
