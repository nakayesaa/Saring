"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PriceEvidenceFinding, PriceEvidenceViewModel } from "@/lib/price-evidence";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function FindingRow({ finding }: { finding: PriceEvidenceFinding }) {
  return (
    <article className="grid gap-3 border-t border-[#d7d9dd] py-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-extrabold leading-6 text-[#0b1b43]">{finding.title}</h3>
          <span className="font-mono text-base font-bold text-[#77869f]">{finding.finding_id}</span>
        </div>
        <p className="mt-1 text-[20px] font-semibold leading-5 text-[#647493]">{finding.summary}</p>
        <p className="mt-1 text-[20px] font-semibold leading-5 text-[#73500a]">
          <span className="font-extrabold">Penjelasan alternatif:</span> {finding.alternative_explanations[0]}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[22px] font-extrabold leading-5 text-[#1450e6]">{finding.metric}</p>
        <p className="mt-1.5 text-[20px] font-bold text-[#647493]">
          <span className="font-mono text-[14px] font-black text-[#0b1b43]">{percent(finding.confidence)}</span> confidence · {finding.evidence_locators.length} sumber
        </p>
      </div>
    </article>
  );
}

export function PriceEvidenceDetails({ evidence }: { evidence: PriceEvidenceViewModel }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const locators = evidence.findings.flatMap((finding) => finding.evidence_locators);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen]);

  const modal = isOpen ? createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#07132e]/75 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-findings-dialog-title"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-[0_32px_90px_-30px_rgb(0_0_0_/_72%)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-[#d7d9dd] px-5 py-4 sm:px-7">
          <div>
            <h2 id="price-findings-dialog-title" className="text-[22px] font-extrabold tracking-[-0.025em] text-[#0b1b43]">Temuan harga</h2>
            <p className="mt-1 text-[20px] font-semibold text-[#647493]">{evidence.package_name} · {evidence.run_id} · {evidence.model_version}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setIsOpen(false)}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#d7d9dd] text-[#647493] transition hover:border-[#aeb4c0] hover:bg-[#f5f5f4] hover:text-[#0b1b43]"
            aria-label="Tutup detail temuan harga"
          >
            <X size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 border-b border-[#b8bbc2] bg-[#0b1b43] text-white sm:grid-cols-4">
            {[
              [evidence.findings.length, "Temuan"],
              [locators.length, "Sumber"],
              [`${evidence.cohort.comparable_observations}/${evidence.cohort.observations_assessed}`, "Comparable"],
              [percent(evidence.confidence), "Confidence"],
            ].map(([value, label]) => (
              <div key={label} className="border-b border-r border-[#304473] px-5 py-3 last:border-r-0 sm:border-b-0 sm:px-7">
                <p className="font-mono text-lg font-black">{value}</p>
                <p className="mt-0.5 text-base font-bold text-[#afbdd7]">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0b1b43]">Evidence findings</h3>
                <span className="font-mono text-base font-bold text-[#647493]">{evidence.result_id}</span>
              </div>
              <div className="mt-3">
                {evidence.findings.map((finding) => <FindingRow key={finding.finding_id} finding={finding} />)}
              </div>

              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-[#b8bbc2] pt-5">
                <h3 className="text-lg font-extrabold tracking-[-0.02em] text-[#0b1b43]">Sumber bukti</h3>
                <span className="text-base font-bold text-[#647493]">{locators.length} locator</span>
              </div>
              <div className="mt-2 divide-y divide-[#d7d9dd] border-y border-[#d7d9dd]">
                {locators.map((locator) => (
                  <Link
                    key={locator.locator_id}
                    href={`/documents?locator=${encodeURIComponent(locator.locator_id)}`}
                    className="grid gap-2 py-3 transition hover:bg-[#f8f9fc] sm:grid-cols-[135px_minmax(0,1fr)_auto] sm:items-center sm:px-1"
                  >
                    <p className="text-[20px] font-extrabold text-[#1450e6]">{locator.label}</p>
                    <p className="min-w-0 truncate font-mono text-base font-bold text-[#647493]">{locator.source} · {locator.locator}</p>
                    <span className="inline-flex items-center gap-1 text-[20px] font-extrabold text-[#1450e6]">Buka <ArrowUpRight size={13} aria-hidden="true" /></span>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="border-t border-[#d7d9dd] bg-[#fafafa] px-5 py-5 lg:border-l lg:border-t-0 sm:px-6 sm:py-6" aria-labelledby="cohort-dialog-title">
              <h3 id="cohort-dialog-title" className="text-lg font-extrabold tracking-[-0.02em] text-[#0b1b43]">Basis pembanding</h3>
              <dl className="mt-3 divide-y divide-[#e1e3e7] border-y border-[#d7d9dd]">
                {evidence.cohort.basis.map((basis) => (
                  <div key={basis.label} className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="text-base font-bold text-[#77869f]">{basis.label}</dt>
                    <dd className="max-w-[195px] text-right text-base font-extrabold leading-4 text-[#0b1b43]">{basis.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5">
                <h3 className="text-[22px] font-extrabold text-[#0b1b43]">Perlu perbandingan manual</h3>
                {evidence.cohort.review_items.map((reviewItem) => (
                  <p key={reviewItem.subject} className="mt-2 text-base font-semibold leading-4 text-[#73500a]">
                    <strong className="font-extrabold">{reviewItem.subject}</strong> · {reviewItem.reason}
                  </p>
                ))}
              </div>

              <div className="mt-5 border-t border-[#b8bbc2] pt-4">
                <h3 className="text-base font-extrabold text-[#0b1b43]">Tindakan review</h3>
                <ul className="mt-2 divide-y divide-[#e1e3e7]">
                  {evidence.recommended_review_actions.map((action) => (
                    <li key={action} className="py-2 text-base font-semibold leading-4 text-[#526383] first:pt-0">{action}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <footer className="grid gap-1 border-t border-[#d7d9dd] bg-[#fff9e8] px-5 py-3 text-base font-semibold leading-5 text-[#73500a] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:px-7">
            <span className="font-extrabold">Batas interpretasi</span>
            <span>{evidence.limitations.join(" ")}</span>
            <span className="font-mono font-bold">Cutoff {evidence.analysis_cutoff_at}</span>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <section className="border-t border-[#b8bbc2] bg-[#f8f9fb] px-5 py-4 sm:px-6" aria-labelledby="price-findings-summary-title">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex w-full items-center justify-between gap-5 rounded-lg border border-[#c6cad2] bg-white px-4 py-4 text-left shadow-[0_8px_18px_-16px_rgb(11_27_67_/_48%)] transition hover:border-[#91a0bd] hover:bg-[#fcfcfc] sm:px-5"
          aria-haspopup="dialog"
        >
          <div className="min-w-0">
            <h2 id="price-findings-summary-title" className="text-lg font-extrabold tracking-[-0.02em] text-[#0b1b43]">Temuan harga</h2>
            <p className="mt-1 text-[20px] font-semibold text-[#647493]">
              {evidence.findings.length} temuan · {locators.length} sumber · {evidence.cohort.comparable_observations} dari {evidence.cohort.observations_assessed} observasi comparable
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 text-[20px] font-extrabold text-[#1450e6]">
            Buka detail <ArrowRight size={16} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>
      </section>
      {modal}
    </>
  );
}
