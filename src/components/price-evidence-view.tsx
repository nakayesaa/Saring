import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PriceEvidenceDetails } from "@/components/price-evidence-details";
import type { PriceEvidenceViewModel } from "@/lib/price-evidence";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function compactIdr(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function LaptopPrototype() {
  return (
    <div className="relative flex min-h-44 items-center justify-center overflow-hidden bg-white px-4 py-5">
      <span className="absolute bottom-6 left-1/2 h-3 w-36 -translate-x-1/2 rounded-full bg-[#0b1b43]/15 blur-md" aria-hidden="true" />
      <svg
        viewBox="0 0 320 200"
        className="relative z-10 w-full max-w-[215px] -translate-y-1 drop-shadow-[0_15px_13px_rgb(11_27_67_/_18%)]"
        role="img"
        aria-label="Representasi laptop bisnis premium dengan bodi aluminium"
      >
        <rect x="50" y="18" width="220" height="137" rx="10" fill="#d3d6dc" />
        <rect x="54" y="22" width="212" height="129" rx="7" fill="#10141d" />
        <rect x="62" y="31" width="196" height="111" rx="3" fill="#1450e6" />
        <path d="M62 31h196v111H145L62 80V31Z" fill="#2b6df2" />
        <path d="M258 31v111H145l113-71V31Z" fill="#091633" fillOpacity="0.34" />
        <path d="M143 31h34v8c0 4-3 7-7 7h-20c-4 0-7-3-7-7v-8Z" fill="#10141d" />
        <circle cx="160" cy="36" r="1.3" fill="#4e596b" />
        <path d="M21 157h278l-12 15c-3 4-8 6-13 6H46c-5 0-10-2-13-6l-12-15Z" fill="#cfd2d8" />
        <path d="M21 157h278l-5 6H26l-5-6Z" fill="#eef0f3" />
        <path d="M132 157h56c0 4-4 7-9 7h-38c-5 0-9-3-9-7Z" fill="#aeb4bd" />
        <path d="M46 178h228" stroke="#9ca3ae" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PriceInterval({ evidence }: { evidence: PriceEvidenceViewModel }) {
  const points = [
    { label: "Q10", value: evidence.interval.q10, dot: "left-[6.7%] bg-[#94a3bd]" },
    { label: "Q50", value: evidence.interval.q50, dot: "left-[15.6%] bg-[#1450e6]" },
    { label: "Q90", value: evidence.interval.q90, dot: "left-[46.7%] bg-[#0b1b43]" },
    { label: "HPS", value: evidence.interval.hps_unit, dot: "left-[60%] bg-[#647493]" },
    { label: "Penawaran", value: evidence.interval.quoted_unit, dot: "left-[92.2%] bg-[#e2b400]" },
  ];

  return (
    <figure aria-labelledby="price-interval-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
        <h2 id="price-interval-title" className="text-[20px] font-extrabold tracking-[-0.02em] text-[#0b1b43]">Posisi harga bersyarat</h2>
        <p className="text-[22px] font-semibold text-[#647493]">Interval setelah normalisasi produk dan komponen layanan · confidence <strong className="font-mono text-[#0b1b43]">{percent(evidence.confidence)}</strong></p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[650px]">
          <div className="relative h-9" aria-hidden="true">
            <div className="absolute inset-x-0 top-3.5 h-1.5 rounded-full bg-[#e5e8ee]">
              <div className="absolute left-[6.7%] right-[53.3%] h-full rounded-full bg-[#9eb8f3]" />
            </div>
            {points.map((point) => (
              <span key={point.label} className={`absolute top-[7px] size-4 -translate-x-1/2 rounded-full border-[3px] border-white shadow-[0_3px_8px_-4px_rgb(11_27_67_/_65%)] ${point.dot}`} />
            ))}
          </div>
          <div className="grid grid-cols-5 divide-x divide-[#e1e3e7] border-t border-[#d7d9dd]">
            {points.map((point) => (
              <div key={point.label} className="px-3 pt-2.5 first:pl-0 last:pr-0">
                <p className="text-[20px] font-bold text-[#647493]">{point.label}</p>
                <p className="mt-0.5 font-mono text-[14px] font-black tracking-[-0.02em] text-[#0b1b43]">{compactIdr(point.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function PriceEvidenceView({ evidence }: { evidence: PriceEvidenceViewModel }) {
  return (
    <div className="contents">
      <PageHeading
        title="Price Evidence"
        description="Posisi harga, kualitas pembanding, dan sumber Price Engine dalam satu tampilan."
      />

      <div className="shell-page-content">
        <Link href={`/packages/${evidence.package_id}/findings`} className="mb-4 inline-flex items-center gap-2 text-[22px] font-bold text-[#647493] transition hover:text-[#1450e6]">
          <ArrowLeft size={16} aria-hidden="true" /> Kembali ke ringkasan temuan
        </Link>

        <article className="overflow-hidden rounded-xl border border-[#aeb4c0] bg-white shadow-[0_16px_36px_-28px_rgb(11_27_67_/_52%)]">
          <header className="flex flex-wrap items-center justify-between gap-2 bg-[#0b1b43] px-5 py-3 text-[20px] font-bold text-[#cbd5e8] sm:px-6">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-white">{evidence.package_name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{evidence.run_id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{evidence.model_version}</span>
            </div>
            <span>Score <strong className="ml-1 font-mono text-white">{percent(evidence.score)}</strong></span>
          </header>

          <section className="grid border-b border-[#b8bbc2] lg:grid-cols-[210px_minmax(0,1fr)_300px]" aria-labelledby="product-title">
            <LaptopPrototype />

            <div className="border-t border-[#d7d9dd] px-5 py-5 lg:border-l lg:border-t-0 lg:px-6">
              <h2 id="product-title" className="text-[22px] font-extrabold tracking-[-0.025em] text-[#0b1b43]">{evidence.item.description}</h2>
              <p className="mt-1 font-mono text-[20px] font-bold text-[#647493]">{evidence.item.item_id}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {evidence.item.specifications.map((specification) => (
                  <div key={specification.label} className="flex items-baseline justify-between gap-3 border-t border-[#e1e3e7] pt-2">
                    <dt className="text-[20px] font-bold text-[#77869f]">{specification.label}</dt>
                    <dd className="text-right text-[20px] font-extrabold leading-5 text-[#0b1b43]">{specification.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border-t border-[#d3aa18] bg-[#f6d64a] px-5 py-5 lg:border-l lg:border-t-0">
              <h3 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0b1b43]">Penawaran berada di atas Q90</h3>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[22px] font-black tracking-[-0.03em] text-[#0b1b43]">{compactIdr(evidence.interval.quoted_unit)}</p>
                  <p className="mt-0.5 text-[20px] font-bold text-[#51430b]">per unit</p>
                </div>
                <p className="font-mono text-[18px] font-black text-[#0b1b43]">+{percent(evidence.interval.relative_deviation)}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 divide-x divide-[#cfaa24] border-t border-[#cfaa24] pt-3">
                <div className="pr-3">
                  <dt className="text-[20px] font-bold text-[#51430b]">Q90</dt>
                  <dd className="mt-0.5 font-mono text-[22px] font-black text-[#0b1b43]">{compactIdr(evidence.interval.q90)}</dd>
                </div>
                <div className="pl-3">
                  <dt className="text-[20px] font-bold text-[#51430b]">Exposure verifikasi</dt>
                  <dd className="mt-0.5 font-mono text-[22px] font-black text-[#0b1b43]">{compactIdr(evidence.interval.exposure)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="border-b border-[#b8bbc2] px-5 py-5 sm:px-6">
            <PriceInterval evidence={evidence} />
          </section>

          <PriceEvidenceDetails evidence={evidence} />
        </article>
      </div>
    </div>
  );
}
