import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { EvidenceBriefActions } from "@/components/evidence-brief-actions";
import { PageHeading } from "@/components/page-heading";
import { ReviewDisposition } from "@/components/review-disposition";
import type {
  BriefCitationView,
  BriefFindingView,
  EvidenceBriefViewModel,
} from "@/lib/evidence-brief";
import { formatIdr } from "@/lib/golden-case";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function compactIdr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function CitationSource({ citation }: { citation: BriefCitationView }) {
  return (
    <div className="flex min-w-0 items-start border-t border-[#e1e3e7] py-3 text-[#1450e6]">
      <span className="min-w-0">
        <span className="block text-[22px] font-extrabold">{citation.label}</span>
        <span className="mt-1 block truncate font-mono text-[20px] font-bold text-[#647493]">
          {citation.source} · {citation.locator}
        </span>
      </span>
    </div>
  );
}

function AlternativeExplanation({ children }: { children: string }) {
  return (
    <div className="mt-5 border-y border-[#ead99e] bg-[#fff9e8] px-4 py-3">
      <p className="text-[22px] font-extrabold text-[#73500a]">Penjelasan alternatif</p>
      <p className="mt-1 text-[14px] font-semibold leading-6 text-[#73500a]">{children}</p>
    </div>
  );
}

function FindingHeader({
  finding,
  module,
}: {
  finding: BriefFindingView;
  module: string;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3 text-[22px] font-extrabold text-[#647493]">
          <span className="text-[#1450e6]">{module}</span>
          <span className="font-mono">{finding.finding_id}</span>
        </div>
        <h3 className="mt-2 max-w-4xl text-[22px] font-extrabold leading-8 tracking-[-0.02em] text-[#0b1b43]">
          {finding.title}
        </h3>
        <p className="mt-2 max-w-[72ch] text-base font-semibold leading-7 text-[#647493]">{finding.summary}</p>
      </div>
      <div className="shrink-0 text-left md:text-right">
        <p className="text-[20px] font-bold text-[#77869f]">Confidence</p>
        <p className="mt-1 font-mono text-[20px] font-black tracking-[-0.03em] text-[#0b1b43]">
          {percent(finding.confidence)}
        </p>
      </div>
    </header>
  );
}

function PriceInterval({ brief }: { brief: EvidenceBriefViewModel }) {
  const { metrics } = brief.price;
  const domainMin = 10_500_000;
  const domainMax = 15_000_000;
  const position = (value: number) => `${((value - domainMin) / (domainMax - domainMin)) * 100}%`;
  const markers = [
    { label: "Q50", value: metrics.q50, tone: "bg-[#1450e6]", placement: "top-0" },
    { label: "Q90", value: metrics.q90, tone: "bg-[#647493]", placement: "bottom-0" },
    { label: "HPS", value: metrics.hps_unit, tone: "bg-[#0b1b43]", placement: "top-0" },
    { label: "Penawaran", value: metrics.quoted_unit, tone: "bg-[#e2b400]", placement: "bottom-0" },
  ];

  return (
    <figure className="mt-6" aria-label={`Posisi harga penawaran ${formatIdr(metrics.quoted_unit)} terhadap Q50 ${formatIdr(metrics.q50)} dan Q90 ${formatIdr(metrics.q90)}`}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div className="relative h-28 px-2" aria-hidden="true">
          <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#e5e7eb]">
            <div
              className="absolute left-0 h-full rounded-full bg-[#cdd8f5]"
              style={{ width: position(metrics.q90) }}
            />
          </div>
          {markers.map((marker) => (
            <div
              key={marker.label}
              className="absolute top-1/2 h-16 w-px -translate-y-1/2 bg-[#9aa4b5]"
              style={{ left: position(marker.value) }}
            >
              <span className={`absolute left-1/2 size-3 -translate-x-1/2 rounded-full ${marker.tone} ${marker.placement === "top-0" ? "top-0" : "bottom-0"}`} />
              <span className={`absolute left-1/2 w-max -translate-x-1/2 text-center ${marker.placement === "top-0" ? "top-[-23px]" : "bottom-[-30px]"}`}>
                <span className="block text-[20px] font-extrabold text-[#647493]">{marker.label}</span>
                <span className="block font-mono text-[20px] font-black text-[#0b1b43]">{compactIdr(marker.value)}</span>
              </span>
            </div>
          ))}
        </div>

        <dl className="divide-y divide-[#e1e3e7] border-y border-[#e1e3e7]">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Deviasi terhadap Q90</dt>
            <dd className="font-mono text-[18px] font-black text-[#0b1b43]">+{percent(metrics.relative_deviation)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Exposure untuk verifikasi</dt>
            <dd className="font-mono text-[18px] font-black text-[#0b1b43]">{compactIdr(metrics.exposure)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Kuantitas</dt>
            <dd className="font-mono text-[16px] font-black text-[#0b1b43]">{metrics.quantity.toLocaleString("id-ID")} unit</dd>
          </div>
        </dl>
      </div>
    </figure>
  );
}

function DocumentComparison({ brief }: { brief: EvidenceBriefViewModel }) {
  const { metrics } = brief.document;
  return (
    <figure className="mt-6" aria-label={`Perbandingan passage ${metrics.vendor_left} dan ${metrics.vendor_right}`}>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[22px] font-bold text-[#647493]">
        <span><strong className="font-mono text-[18px] font-black text-[#0b1b43]">{percent(metrics.similarity)}</strong> similarity</span>
        <span>{metrics.template_excluded ? "Template wajib dikeluarkan" : "Template belum dikeluarkan"}</span>
        <span>{metrics.rare_shared_errors} rare shared typo</span>
      </div>
      <div className="grid overflow-hidden rounded-lg border border-[#d7d9dd] md:grid-cols-2 md:divide-x md:divide-[#d7d9dd]">
        {[
          { vendor: metrics.vendor_left, passage: metrics.passage_left, citation: brief.document.citations[0] },
          { vendor: metrics.vendor_right, passage: metrics.passage_right, citation: brief.document.citations[1] },
        ].map(({ vendor, passage, citation }, index) => (
          <div key={vendor} className={index > 0 ? "border-t border-[#d7d9dd] md:border-t-0" : ""}>
            <div className="border-b border-[#e1e3e7] bg-[#f5f5f4] px-4 py-3">
              <p className="text-[14px] font-extrabold text-[#0b1b43]">{vendor}</p>
              <p className="mt-1 font-mono text-[20px] font-bold text-[#77869f]">{citation?.locator}</p>
            </div>
            <blockquote className="px-4 py-5 text-base font-semibold leading-7 text-[#526383]">
              <mark className="bg-[#fff0a8] px-0.5 text-[#26324d]">{passage}</mark>
            </blockquote>
          </div>
        ))}
      </div>
    </figure>
  );
}

function GraphMotif({ brief }: { brief: EvidenceBriefViewModel }) {
  const { metrics } = brief.graph;
  return (
    <figure className="mt-6 overflow-hidden rounded-lg border border-[#d7d9dd] bg-[#f8f8f7]" aria-label="Motif co-bidding tiga vendor">
      <div className="grid gap-4 px-4 py-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:px-6">
        <svg viewBox="0 0 680 230" className="h-auto w-full" role="img" aria-label={`${metrics.historical_co_bids} co-bids dan ${metrics.award_rotations} award rotations`}>
          <g fill="none" stroke="#9aabc8" strokeWidth="3">
            <path d="M142 54 L340 114" />
            <path d="M142 176 L340 114" />
            <path d="M538 114 L340 114" />
          </g>
          <g fill="#ffffff" stroke="#1450e6" strokeWidth="4">
            <circle cx="120" cy="48" r="38" />
            <circle cx="120" cy="182" r="38" />
            <circle cx="560" cy="115" r="38" />
          </g>
          <circle cx="340" cy="114" r="58" fill="#0b1b43" />
          <g fill="#0b1b43" fontFamily="Manrope Variable, sans-serif" fontSize="18" fontWeight="800" textAnchor="middle">
            <text x="120" y="54">V03</text>
            <text x="120" y="188">V06</text>
            <text x="560" y="121">V07</text>
          </g>
          <g fill="#ffffff" fontFamily="Manrope Variable, sans-serif" textAnchor="middle">
            <text x="340" y="109" fontSize="27" fontWeight="900">{metrics.historical_co_bids}</text>
            <text x="340" y="134" fontSize="14" fontWeight="700">co-bids</text>
          </g>
        </svg>

        <dl className="divide-y divide-[#d7d9dd] border-y border-[#d7d9dd]">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Award rotations</dt>
            <dd className="font-mono text-[18px] font-black text-[#0b1b43]">{metrics.award_rotations}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Riwayat cutoff-safe</dt>
            <dd className="text-[14px] font-extrabold text-[#168b55]">Ya</dd>
          </div>
          <div className="py-3">
            <dt className="text-[22px] font-bold text-[#647493]">Entitas</dt>
            <dd className="mt-2 space-y-1 text-[22px] font-bold text-[#2d3f66]">
              {metrics.vendor_labels.map((label, index) => <span key={label} className="block">{metrics.vendor_ids[index]} · {label}</span>)}
            </dd>
          </div>
        </dl>
      </div>
    </figure>
  );
}

export function EvidenceBriefView({ brief }: { brief: EvidenceBriefViewModel }) {
  return (
    <div className="contents">
      <PageHeading
        title="Evidence Brief"
        description="Ringkasan bukti pra-penetapan yang dapat ditelusuri kembali ke hasil mesin dan sumber canonical."
        actions={<EvidenceBriefActions />}
      />

      <div className="shell-page-content evidence-brief-print-root">
        <Link href={`/packages/${brief.package_id}/findings`} className="mb-5 inline-flex items-center gap-2 text-[14px] font-bold text-[#647493] transition hover:text-[#1450e6] print:hidden">
          <ArrowLeft size={17} aria-hidden="true" /> Kembali ke ringkasan temuan
        </Link>

        <article className="overflow-hidden rounded-xl border border-[#b8bbc2] bg-white print:border-0" aria-labelledby="brief-title">
          <header className="bg-[#0b1b43] px-6 py-6 text-white sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-[22px] font-bold text-[#afbdd7]">
                <span>{brief.package_name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{brief.brief_id} · v{brief.brief_version}</span>
              </div>
              <span className="inline-flex items-center gap-2 text-[22px] font-extrabold text-white">
                <span className="size-2 rounded-full bg-[#c7ff00]" aria-hidden="true" /> Siap untuk review
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div>
                <h1 id="brief-title" className="max-w-4xl text-[28px] font-extrabold leading-[1.2] tracking-[-0.025em] text-white">
                  Prioritaskan paket ini untuk pemeriksaan terfokus sebelum penetapan.
                </h1>
                <p className="mt-3 max-w-[72ch] text-base font-semibold leading-7 text-[#cbd5e8]">{brief.narrative}</p>
              </div>
              <div className="border-t border-[#304473] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="text-[20px] font-bold text-[#afbdd7]">Review priority</p>
                <p className="mt-1 text-[22px] font-extrabold tracking-[-0.025em] text-white">Tinggi</p>
                <p className="mt-1 text-[22px] font-semibold text-[#cbd5e8]">Human decision required</p>
              </div>
            </div>

            <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t border-[#304473] pt-4 text-[22px]">
              {[
                ["Temuan", String(brief.finding_count)],
                ["Source locator", String(brief.source_citation_count)],
                ["Kelengkapan", percent(brief.evidence_completeness)],
                ["Abstention", String(brief.abstention_count)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="font-bold text-[#afbdd7]">{label}</dt>
                  <dd className="font-mono text-base font-black text-white">{value}</dd>
                </div>
              ))}
              <div className="flex items-baseline gap-2 sm:ml-auto">
                <dt className="font-bold text-[#afbdd7]">Cutoff</dt>
                <dd className="font-mono text-[22px] font-black text-white">{brief.analysis_cutoff_at}</dd>
              </div>
            </dl>
          </header>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 px-6 py-7 sm:px-8 xl:border-r xl:border-[#d7d9dd]">
              <section aria-labelledby="convergence-title">
                <h2 id="convergence-title" className="text-[22px] font-extrabold tracking-[-0.02em] text-[#0b1b43]">Konvergensi bukti</h2>
                <p className="mt-1 text-[14px] font-semibold leading-6 text-[#647493]">Score dan confidence tetap dipisahkan untuk setiap mesin.</p>
                <div className="mt-5 divide-y divide-[#e1e3e7] border-y border-[#d7d9dd]">
                  {brief.modules.map((module) => (
                    <div key={module.engine} className="grid gap-3 py-4 md:grid-cols-[110px_minmax(0,1fr)_90px_100px] md:items-center md:gap-5">
                      <div>
                        <p className="text-base font-extrabold text-[#0b1b43]">{module.label}</p>
                        <p className="mt-0.5 text-[20px] font-bold text-[#77869f]">{module.finding_count} temuan</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]" aria-hidden="true">
                        <div className="h-full rounded-full bg-[#1450e6]" style={{ width: percent(module.score) }} />
                      </div>
                      <div>
                        <p className="text-[20px] font-bold text-[#77869f]">Score</p>
                        <p className="font-mono text-lg font-black text-[#0b1b43]">{percent(module.score)}</p>
                      </div>
                      <div>
                        <p className="text-[20px] font-bold text-[#77869f]">Confidence</p>
                        <p className="font-mono text-lg font-black text-[#0b1b43]">{percent(module.confidence)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-9 border-t border-[#b8bbc2] pt-7" aria-labelledby="price-finding-title">
                <FindingHeader finding={brief.price} module="Harga" />
                <span id="price-finding-title" className="sr-only">Temuan harga</span>
                <PriceInterval brief={brief} />
                <AlternativeExplanation>{brief.price.alternative_explanation}</AlternativeExplanation>
                <div className="mt-4">
                  {brief.price.citations.map((citation) => <CitationSource key={citation.locator_id} citation={citation} />)}
                </div>
              </section>

              <section className="mt-9 border-t border-[#b8bbc2] pt-7" aria-labelledby="document-finding-title">
                <FindingHeader finding={brief.document} module="Dokumen" />
                <span id="document-finding-title" className="sr-only">Temuan dokumen</span>
                <DocumentComparison brief={brief} />
                <AlternativeExplanation>{brief.document.alternative_explanation}</AlternativeExplanation>
                <div className="mt-4">
                  {brief.document.citations.map((citation) => <CitationSource key={citation.locator_id} citation={citation} />)}
                </div>
              </section>

              <section className="mt-9 border-t border-[#b8bbc2] pt-7" aria-labelledby="graph-finding-title">
                <FindingHeader finding={brief.graph} module="Relasi" />
                <span id="graph-finding-title" className="sr-only">Temuan relasi</span>
                <GraphMotif brief={brief} />
                <AlternativeExplanation>{brief.graph.alternative_explanation}</AlternativeExplanation>
                <div className="mt-4">
                  {brief.graph.citations.map((citation) => <CitationSource key={citation.locator_id} citation={citation} />)}
                </div>
              </section>

              <footer className="mt-9 flex gap-3 border-t border-[#b8bbc2] pt-6">
                <ShieldCheck className="mt-0.5 shrink-0 text-[#168b55]" size={20} aria-hidden="true" />
                <p className="max-w-[72ch] text-[22px] font-semibold leading-6 text-[#647493]">
                  Brief ini dirender dari structured findings dan source locator. Narasi tidak boleh menambahkan entitas, nilai, klaim, atau citation yang tidak tersedia pada engine output.
                </p>
              </footer>
            </main>

            <aside className="min-w-0 border-t border-[#d7d9dd] bg-[#f7f7f6] px-6 py-7 sm:px-8 xl:border-t-0" aria-label="Review actions and provenance">
              <div className="space-y-7 xl:sticky xl:top-6">
                <section aria-labelledby="actions-title">
                  <h2 id="actions-title" className="text-[20px] font-extrabold tracking-[-0.02em] text-[#0b1b43]">Tindakan yang disarankan</h2>
                  <ol className="mt-4 divide-y divide-[#d7d9dd] border-y border-[#d7d9dd]">
                    {brief.recommended_review_actions.map((action, index) => (
                      <li key={action.code} className="flex gap-3 py-3.5">
                        <span className="font-mono text-[20px] font-black text-[#1450e6]">{String(index + 1).padStart(2, "0")}</span>
                        <span className="text-[14px] font-bold leading-6 text-[#526383]">{action.label}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section aria-labelledby="limitations-title">
                  <h2 id="limitations-title" className="text-[18px] font-extrabold text-[#0b1b43]">Limitasi</h2>
                  <ul className="mt-3 space-y-3">
                    {brief.limitations.map((limitation) => (
                      <li key={limitation} className="flex gap-2.5 text-[22px] font-semibold leading-6 text-[#647493]">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#d4a700]" aria-hidden="true" />
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="border-t border-[#b8bbc2] pt-6 print:hidden" aria-labelledby="decision-title">
                  <h2 id="decision-title" className="text-[18px] font-extrabold text-[#0b1b43]">Keputusan reviewer</h2>
                  <p className="mt-1 text-[22px] font-semibold text-[#647493]">Keputusan manusia diperlukan sebelum tindak lanjut.</p>
                  <div className="mt-4"><ReviewDisposition /></div>
                </section>

                <section className="border-t border-[#b8bbc2] pt-6" aria-labelledby="provenance-title">
                  <h2 id="provenance-title" className="text-[18px] font-extrabold text-[#0b1b43]">Provenance</h2>
                  <dl className="mt-3 divide-y divide-[#d7d9dd]">
                    {[
                      ["Analysis run", brief.run_id],
                      ["Audit log", brief.provenance.audit_log_ref],
                      ["Renderer", brief.provenance.renderer],
                      ["Factuality", brief.provenance.factuality_status],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-[20px]">
                        <dt className="font-bold text-[#77869f]">{label}</dt>
                        <dd className="text-right font-mono font-black text-[#0b1b43]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href={`/packages/${brief.package_id}/findings`} className="mt-4 inline-flex items-center gap-2 text-[22px] font-extrabold text-[#1450e6] transition hover:text-[#0c43cc] print:hidden">
                    Lihat seluruh temuan <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </section>

                <div className="hidden items-center gap-2 border-t border-[#b8bbc2] pt-4 text-[20px] font-bold text-[#647493] print:flex">
                  <Check size={15} className="text-[#168b55]" aria-hidden="true" /> Generated from validated structured evidence
                </div>
              </div>
            </aside>
          </div>
        </article>
      </div>
    </div>
  );
}
