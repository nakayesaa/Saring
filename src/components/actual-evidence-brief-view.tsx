import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { EvidenceBriefActions } from "@/components/evidence-brief-actions";
import { PageHeading } from "@/components/page-heading";
import type { AnalysisFindingView, AnalysisFindingsViewModel } from "@/lib/analysis-findings";

const engineLabels = { PRICE: "Harga", DOCUMENT: "Dokumen", GRAPH: "Relasi" } as const;
const engineRoutes = { PRICE: "price", DOCUMENT: "documents", GRAPH: "network" } as const;
const engineStatusLabels = {
  SCORED: "Dapat dinilai",
  LOW_CONFIDENCE: "Bukti pembanding terbatas",
  ABSTAINED: "Data belum cukup",
  NOT_APPLICABLE: "Tidak relevan",
} as const;

function percent(value: number | null) {
  return value === null ? "Tidak tersedia" : `${Math.round(value * 100)}%`;
}

function metricLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function metricValue(value: string | number | boolean | null) {
  if (value === null) return "Tidak tersedia";
  if (value === "EXACT") return "Pencocokan persis";
  if (value === "NEAR") return "Kemiripan tinggi";
  if (value === true) return "Ya";
  if (value === false) return "Tidak";
  return String(value);
}

function idr(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value) : "—";
}

function primaryFacts(finding: AnalysisFindingView, engine: keyof typeof engineLabels) {
  if (engine === "PRICE") {
    const quoted = finding.metrics.quoted_or_hps_value;
    const q90 = finding.metrics.q90;
    const exposure = finding.metrics.estimated_exposure_requiring_verification;
    const quantity = typeof finding.metrics.quantity === "number" ? finding.metrics.quantity :
      typeof quoted === "number" && typeof q90 === "number" && typeof exposure === "number" && quoted > q90 ? Math.round(exposure / (quoted - q90)) : null;
    const deviation = typeof quoted === "number" && typeof q90 === "number" && q90 > 0
      ? Math.max(0, (quoted - q90) / q90)
      : null;
    const q90Exposure = typeof quoted === "number" && typeof q90 === "number" && quantity !== null
      ? Math.max(0, quoted - q90) * quantity
      : null;
    return [
    ["Harga dievaluasi", idr(finding.metrics.quoted_or_hps_value)],
    ["Batas pembanding Q90", idr(finding.metrics.q90)],
    ["Jumlah pengadaan", quantity === null ? "—" : `${quantity.toLocaleString("id-ID")} unit`],
    ["Deviasi di atas Q90", percent(deviation)],
    ["Selisih total untuk diverifikasi", idr(q90Exposure)],
    ];
  }
  if (engine === "DOCUMENT") return [
    ["Dokumen terkait", finding.subject_ids.join(" ↔ ") || "Lihat sumber"],
    ["Kemiripan ternormalisasi", typeof finding.metrics.normalized_similarity === "number" ? percent(finding.metrics.normalized_similarity) : "—"],
    ["Panjang passage substantif", String(finding.metrics.longest_substantive_run ?? "—")],
    ["Metode pembandingan", finding.metrics.comparison_method === "EXACT" ? "Pencocokan persis" : String(finding.metrics.comparison_method ?? "—")],
  ];
  return [
    ["Pasangan vendor", finding.subject_ids.join(" ↔ ") || "Lihat source locator"],
    ["Tender bersama", `${String(finding.metrics.co_bid_count ?? "—")} tender historis`],
    ["Ambang referensi", `${String(finding.metrics.reference_threshold ?? "—")} tender`],
    ["Persentil pembanding", typeof finding.metrics.reference_upper_percentile === "number" ? percent(finding.metrics.reference_upper_percentile) : "—"],
  ];
}

function FindingCard({ finding, engine }: { finding: AnalysisFindingView; engine: keyof typeof engineLabels }) {
  const metrics = Object.entries(finding.metrics).filter(([, value]) => value !== null);
  const facts = primaryFacts(finding, engine);
  return (
    <article className="rounded-xl border border-[#d7d9dd] bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold text-[#1450e6]">{engineLabels[engine]} · {finding.finding_id}</p>
          <h3 className="mt-2 text-xl font-extrabold text-[#0b1b43]">{finding.title}</h3>
          <p className="mt-2 max-w-[78ch] text-sm font-semibold leading-6 text-[#526383]">{finding.summary}</p>
        </div>
        <dl className="flex shrink-0 gap-5 text-sm md:text-right">
          <div><dt className="font-bold text-[#77869f]">Kekuatan pola</dt><dd className="font-mono font-black text-[#0b1b43]">{percent(finding.score)}</dd></div>
          <div><dt className="font-bold text-[#77869f]">Kecukupan bukti</dt><dd className="font-mono font-black text-[#0b1b43]">{percent(finding.confidence)}</dd></div>
        </dl>
      </div>

      <dl className="mt-5 grid gap-3 rounded-lg bg-[#f5f5f4] p-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => <div key={label}><dt className="text-xs font-bold text-[#77869f]">{label}</dt><dd className="mt-1 break-words font-mono text-sm font-black text-[#0b1b43]">{value}</dd></div>)}
      </dl>

      {metrics.length > 0 && (
        <details className="mt-4 rounded-lg border border-[#e1e3e7] px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-[#1450e6]">Lihat seluruh parameter teknis</summary>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold text-[#77869f]">{metricLabel(label)}</dt>
              <dd className="mt-1 break-words font-mono text-sm font-black text-[#0b1b43]">{metricValue(value)}</dd>
            </div>
          ))}
          </dl>
        </details>
      )}

      {finding.alternative_explanations.length > 0 && (
        <div className="mt-5 border-y border-[#ead99e] bg-[#fff9e8] px-4 py-3">
          <p className="text-sm font-extrabold text-[#73500a]">Penjelasan alternatif</p>
          {finding.alternative_explanations.map((explanation) => <p key={explanation} className="mt-1 text-sm font-semibold leading-6 text-[#73500a]">{explanation}</p>)}
        </div>
      )}

      <details className="mt-4 rounded-lg border border-[#e1e3e7] px-4 py-3">
        <summary className="cursor-pointer text-sm font-bold text-[#1450e6]">Lihat {finding.evidence_locators.length} bukti sumber</summary>
        <div className="mt-3">
        {finding.evidence_locators.map((citation) => (
          <div key={citation.locator_id} className="border-t border-[#e1e3e7] py-3">
            <p className="text-sm font-extrabold text-[#1450e6]">{citation.label}</p>
            <p className="mt-1 break-all font-mono text-xs font-bold text-[#647493]">{citation.source} · {citation.locator}</p>
            <p className="mt-1 text-sm leading-6 text-[#526383]">{citation.excerpt}</p>
          </div>
        ))}
        </div>
      </details>
    </article>
  );
}

export function ActualEvidenceBriefView({ analysis }: { analysis: AnalysisFindingsViewModel }) {
  const priority = {
    HIGH: "Tinggi", MEDIUM: "Sedang", LOW: "Rendah",
    NO_SIGNIFICANT_ALERT: "Tidak ada alert signifikan", INSUFFICIENT_DATA: "Data belum cukup",
  }[analysis.review_priority];

  return (
    <div className="contents">
      <PageHeading title="Evidence Brief" description="Laporan dinamis dari structured findings pada analysis run aktual." actions={<EvidenceBriefActions />} />
      <div className="shell-page-content evidence-brief-print-root">
        <Link href={`/packages/${analysis.package_id}/findings`} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#647493] print:hidden">
          <ArrowLeft size={17} /> Kembali ke ringkasan temuan
        </Link>
        <article className="overflow-hidden rounded-xl border border-[#b8bbc2] bg-white">
          <header className="bg-[#0b1b43] px-6 py-6 text-white sm:px-8">
            <p className="text-sm font-bold text-[#afbdd7]">{analysis.package_name}</p>
            <h1 className="mt-2 text-2xl font-extrabold">Laporan hasil analysis run {analysis.run_id}</h1>
            <p className="mt-3 text-sm font-semibold text-[#cbd5e8]">Sinyal berikut memprioritaskan pemeriksaan manusia dan bukan kesimpulan fraud, kolusi, atau kerugian negara.</p>
            <dl className="mt-5 flex flex-wrap gap-6 border-t border-[#304473] pt-4 text-sm">
              <div><dt className="text-[#afbdd7]">Prioritas</dt><dd className="font-black">{priority}</dd></div>
              <div><dt className="text-[#afbdd7]">Temuan</dt><dd className="font-mono font-black">{analysis.finding_count}</dd></div>
              <div><dt className="text-[#afbdd7]">Source locator</dt><dd className="font-mono font-black">{analysis.source_citation_count}</dd></div>
              <div><dt className="text-[#afbdd7]">Abstention</dt><dd className="font-mono font-black">{analysis.abstention_count}</dd></div>
              <div className="sm:ml-auto"><dt className="text-[#afbdd7]">Cutoff</dt><dd className="font-mono font-black">{analysis.analysis_cutoff_at}</dd></div>
            </dl>
          </header>
          <main className="px-6 py-7 sm:px-8">
            <section className="grid gap-3 md:grid-cols-3">
              {analysis.modules.map((module) => (
                <Link href={`/packages/${analysis.package_id}/${engineRoutes[module.engine]}`} key={module.engine} className="rounded-lg border border-[#d7d9dd] p-4 transition hover:border-[#1450e6] hover:bg-[#f7f9ff]">
                  <p className="font-extrabold text-[#0b1b43]">{engineLabels[module.engine]}</p>
                  <p className="mt-1 text-sm text-[#647493]">{module.findings.length} temuan · {engineStatusLabels[module.status]}</p>
                  <p className="mt-3 font-mono text-xs text-[#526383]">{module.engine_version}{module.model_version ? ` · ${module.model_version}` : ""}</p>
                  <p className="mt-3 text-sm font-bold text-[#1450e6]">Buka detail dan visualisasi →</p>
                </Link>
              ))}
            </section>
            {analysis.modules.map((module) => (
              <section key={module.engine} className="mt-9" id={`engine-${module.engine.toLowerCase()}`}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#b8bbc2] pb-3">
                  <div><h2 className="text-2xl font-extrabold text-[#0b1b43]">{engineLabels[module.engine]}</h2><p className="mt-1 text-sm font-semibold text-[#647493]">{module.summary}</p></div>
                  <Link href={`/packages/${analysis.package_id}/${engineRoutes[module.engine]}`} className="text-sm font-extrabold text-[#1450e6]">Buka tampilan {engineLabels[module.engine]} →</Link>
                </div>
                <div className="space-y-4">
                  {[...module.findings].sort((left, right) => (right.score ?? 0) - (left.score ?? 0)).map((finding) => <FindingCard key={`${module.engine}:${finding.finding_id}`} finding={finding} engine={module.engine} />)}
                  {module.findings.length === 0 && <p className="rounded-lg bg-[#f5f5f4] p-4 text-sm text-[#647493]">Engine tidak menghasilkan temuan pada run ini.</p>}
                </div>
              </section>
            ))}
            {analysis.abstentions.length > 0 && (
              <section className="mt-7 border-t border-[#b8bbc2] pt-6">
                <h2 className="text-lg font-extrabold text-[#0b1b43]">Abstention</h2>
                {analysis.abstentions.map((item) => <p key={`${item.module}:${item.subject_id}`} className="mt-2 text-sm text-[#526383]">{item.module}: {item.reason}</p>)}
              </section>
            )}
            <footer className="mt-7 flex gap-3 border-t border-[#b8bbc2] pt-6 text-sm font-semibold text-[#647493]">
              <ShieldCheck className="shrink-0 text-[#168b55]" size={20} />
              Data pada brief ini diproyeksikan dari run yang sama dengan halaman Temuan Analisis. Tidak ada golden fixture atau angka contoh yang digunakan.
            </footer>
          </main>
        </article>
      </div>
    </div>
  );
}
