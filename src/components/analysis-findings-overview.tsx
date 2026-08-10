import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import type { AnalysisFindingsViewModel, AnalysisModuleView } from "@/lib/analysis-findings";

const modulePresentation: Record<
  AnalysisModuleView["engine"],
  { label: string; route: string }
> = {
  PRICE: { label: "Harga", route: "price" },
  DOCUMENT: { label: "Dokumen", route: "documents" },
  GRAPH: { label: "Relasi", route: "network" },
};

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function AnalysisFindingsOverview({ analysis }: { analysis: AnalysisFindingsViewModel }) {
  const priorityLabel = {
    HIGH: "Prioritas review tinggi",
    MEDIUM: "Prioritas review sedang",
    LOW: "Prioritas review rendah",
    NO_SIGNIFICANT_ALERT: "Tidak ada alert signifikan",
    INSUFFICIENT_DATA: "Bukti belum mencukupi",
  }[analysis.review_priority];

  return (
    <div className="contents">
      <PageHeading
        title="Temuan analisis"
        description="Tinjau sinyal lintas mesin, penjelasan alternatif, dan sumber yang mendasarinya sebelum mengambil tindakan."
        actions={(
          <PrimaryActionLink href={`/packages/${analysis.package_id}/brief`}>
            Get Report <ArrowRight size={18} aria-hidden="true" />
          </PrimaryActionLink>
        )}
      />

      <div data-demo-tour="findings" className="shell-page-content">
        <section className="overflow-hidden rounded-xl bg-[#0b1b43] text-white">
          <div className="px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
              <span className="text-white">{analysis.package_name}</span>
              <span className="font-mono text-xs text-[#afbdd7]">{analysis.run_id}</span>
            </div>

            <div className="mt-3 flex items-center gap-6">
              <div className="flex shrink-0 items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full bg-[#c7ff00]" aria-hidden="true" />
                <h2 className="whitespace-nowrap text-base font-extrabold text-white">{priorityLabel}</h2>
              </div>
              <p className="min-w-0 text-sm font-bold leading-6 text-white sm:whitespace-nowrap sm:text-base">
                {analysis.modules.length} mesin menghasilkan {analysis.finding_count} temuan dari {analysis.source_citation_count} sumber. Verifikasi bukti utama sebelum membuka laporan.
              </p>
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-[#263a69] px-5 py-3 text-sm sm:px-7">
            <div className="flex items-baseline gap-2.5">
              <dt className="font-bold text-[#afbdd7]">Indeks prioritas</dt>
              <dd className="font-mono text-base font-black text-white">{analysis.fusion.review_priority_index}/100</dd>
            </div>
            <div className="flex items-baseline gap-2.5">
              <dt className="font-bold text-[#afbdd7]">Temuan</dt>
              <dd className="font-mono text-base font-black text-white">{analysis.finding_count}</dd>
            </div>
            <div className="flex items-baseline gap-2.5">
              <dt className="font-bold text-[#afbdd7]">Source locator</dt>
              <dd className="font-mono text-base font-black text-white">{analysis.source_citation_count}</dd>
            </div>
            <div className="flex items-baseline gap-2.5">
              <dt className="font-bold text-[#afbdd7]">Abstention</dt>
              <dd className="font-mono text-base font-black text-white">{analysis.abstention_count}</dd>
            </div>
            <div className="flex items-baseline gap-2.5 sm:ml-auto">
              <dt className="font-bold text-[#afbdd7]">Analysis cutoff</dt>
              <dd className="font-mono text-base font-black text-white">{analysis.analysis_cutoff_at}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-5 rounded-xl border border-[#c9cdd4] bg-white px-5 py-4 sm:px-7" aria-label="Konvergensi bukti lintas mesin">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-[#0b1b43]">Konvergensi bukti lintas mesin</h2>
              <p className="mt-1 text-sm font-medium text-[#647493]">
                {analysis.fusion.corroborating_module_count} dari {analysis.fusion.available_module_count} mesin memberikan sinyal yang saling mendukung. Bobot telah disesuaikan dengan kecukupan bukti.
              </p>
            </div>
            <dl className="flex gap-7 text-sm">
              <div><dt className="font-bold text-[#77869f]">Confidence fusion</dt><dd className="mt-1 font-mono text-lg font-black text-[#0b1b43]">{percent(analysis.fusion.evidence_confidence)}</dd></div>
              <div><dt className="font-bold text-[#77869f]">Pendorong utama</dt><dd className="mt-1 font-mono text-lg font-black text-[#0b1b43]">{analysis.fusion.dominant_module ?? "—"}</dd></div>
            </dl>
          </div>
        </section>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0b1b43]">Ringkasan temuan</h2>
          <Link href={`/packages/${analysis.package_id}/processing`} className="inline-flex items-center gap-2 text-sm font-bold text-[#647493] transition hover:text-[#1450e6]">
            <ArrowLeft size={17} aria-hidden="true" /> Lihat proses analisis
          </Link>
        </div>

        <section className="mt-5 overflow-hidden rounded-xl border border-[#c9cdd4] bg-white" aria-label="Temuan per mesin analisis">
          <div className="divide-y divide-[#e1e3e7]">
            {analysis.modules.map((module) => {
              const presentation = modulePresentation[module.engine];
              const primaryFinding = module.findings[0];

              return (
                <article key={module.engine} className="grid min-w-0 gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[120px_minmax(0,1fr)_170px_150px] lg:items-center lg:gap-7">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0b1b43]">{presentation.label}</h3>
                    <p className="mt-1 text-xs font-bold text-[#77869f]">{module.findings.length} temuan</p>
                  </div>

                  {primaryFinding ? (
                    <div className="min-w-0">
                      <p className="text-base font-extrabold leading-6 text-[#17191d]">{primaryFinding.title}</p>
                      <p className="mt-1 line-clamp-1 max-w-[72ch] text-sm font-medium leading-6 text-[#647493]">{primaryFinding.summary}</p>
                    </div>
                  ) : <p className="text-sm font-medium text-[#647493]">Tidak ada temuan untuk mesin ini.</p>}

                  <dl className="grid grid-cols-2 gap-5 lg:gap-7">
                    <div>
                      <dt className="text-xs font-bold text-[#77869f]">Kekuatan pola</dt>
                      <dd className="mt-1 font-mono text-xl font-black tracking-[-0.03em] text-[#0b1b43]">{percent(module.score)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-[#77869f]">Kecukupan bukti</dt>
                      <dd className="mt-1 font-mono text-xl font-black tracking-[-0.03em] text-[#0b1b43]">{percent(module.confidence)}</dd>
                    </div>
                  </dl>

                  <Link href={`/packages/${analysis.package_id}/${presentation.route}`} className="inline-flex min-h-11 items-center justify-between gap-3 text-sm font-extrabold text-[#0b1b43] transition hover:text-[#1450e6] max-lg:w-fit">
                    Lihat detail
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>

                </article>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
