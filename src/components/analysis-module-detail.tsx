import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import type { AnalysisModuleView } from "@/lib/analysis-findings";

const statusLabel: Record<AnalysisModuleView["status"], string> = {
  SCORED: "Hasil dapat dinilai",
  LOW_CONFIDENCE: "Sinyal terdeteksi · bukti pembanding terbatas",
  ABSTAINED: "Data belum cukup untuk dinilai",
  NOT_APPLICABLE: "Tidak relevan untuk paket ini",
};

const scopeLabel = { PACKAGE: "PAKET", VENDOR: "VENDOR", CROSS_VENDOR: "LINTAS VENDOR", ITEM: "BARANG" } as const;

function idr(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value) : "—";
}

function priceQuantity(metrics: AnalysisModuleView["findings"][number]["metrics"]) {
  if (typeof metrics.quantity === "number") return metrics.quantity;
  const quoted = metrics.quoted_or_hps_value;
  const q90 = metrics.q90;
  const exposure = metrics.estimated_exposure_requiring_verification;
  if (typeof quoted !== "number" || typeof q90 !== "number" || typeof exposure !== "number" || quoted <= q90) return null;
  return Math.round(exposure / (quoted - q90));
}

function priceExposureAboveQ90(metrics: AnalysisModuleView["findings"][number]["metrics"]) {
  const quoted = metrics.quoted_or_hps_value;
  const q90 = metrics.q90;
  const quantity = priceQuantity(metrics);
  if (typeof quoted !== "number" || typeof q90 !== "number" || quantity === null) return null;
  return Math.max(0, quoted - q90) * quantity;
}

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function AnalysisModuleDetail({
  packageId,
  packageName,
  title,
  description,
  module,
  visualization,
}: {
  packageId: string;
  packageName: string;
  title: string;
  description: string;
  module: AnalysisModuleView;
  visualization?: ReactNode;
}) {
  return (
    <div className="contents">
      <PageHeading title={title} description={description} />
      <div data-demo-tour-engine={module.engine} className="shell-page-content">
        <Link
          href={`/packages/${packageId}/findings`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#647493] hover:text-[#1450e6]"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Kembali ke seluruh temuan
        </Link>

        <section className="mt-5 rounded-xl bg-[#0b1b43] px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#afbdd7]">{packageName}</p>
              <h2 className="mt-1 text-xl font-extrabold">{statusLabel[module.status]}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#dce5f7]">{module.summary}</p>
            </div>
            <dl className="flex gap-7">
              <div>
                <dt className="text-xs font-bold text-[#afbdd7]">Kekuatan pola</dt>
                <dd className="mt-1 font-mono text-xl font-black">{percent(module.score)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#afbdd7]">Kecukupan bukti</dt>
                <dd className="mt-1 font-mono text-xl font-black">{percent(module.confidence)}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-4 font-mono text-xs text-[#afbdd7]">
            {module.engine_version} · {module.model_version ?? "deterministic-rules"}
          </p>
        </section>

        {visualization}

        <section className="mt-7">
          <h2 className="text-2xl font-extrabold text-[#0b1b43]">Sinyal berbasis bukti</h2>
          {module.findings.length === 0 ? (
            <div className="mt-4 rounded-xl border border-[#c9cdd4] bg-white p-6 text-sm text-[#647493]">
              Mesin tidak menerbitkan temuan. Perhatikan status dan alasan abstention di atas.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {module.findings.map((finding) => (
                <article key={finding.finding_id} className="rounded-xl border border-[#c9cdd4] bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#647493]">{scopeLabel[finding.scope]}</p>
                      <h3 className="mt-1 text-lg font-extrabold text-[#0b1b43]">{finding.title}</h3>
                    </div>
                    <span className="rounded-full bg-[#eef3ff] px-3 py-1 font-mono text-xs font-bold text-[#1450e6]">
                      {finding.metric}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#4f5e77]">{finding.summary}</p>

                  {module.engine === "PRICE" && (
                    <div className="mt-4 rounded-lg border border-[#d7d9dd] bg-[#f7f7f6] p-4">
                      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <div><dt className="text-xs font-bold text-[#647493]">Harga diperiksa</dt><dd className="mt-1 font-mono font-black text-[#0b1b43]">{idr(finding.metrics.quoted_or_hps_value)}</dd></div>
                        <div><dt className="text-xs font-bold text-[#647493]">Median pembanding (Q50)</dt><dd className="mt-1 font-mono font-black text-[#0b1b43]">{idr(finding.metrics.q50)}</dd></div>
                        <div><dt className="text-xs font-bold text-[#647493]">Batas atas pembanding (Q90)</dt><dd className="mt-1 font-mono font-black text-[#0b1b43]">{idr(finding.metrics.q90)}</dd></div>
                        <div><dt className="text-xs font-bold text-[#647493]">Jumlah pengadaan</dt><dd className="mt-1 font-mono font-black text-[#0b1b43]">{priceQuantity(finding.metrics)?.toLocaleString("id-ID") ?? "—"} unit</dd></div>
                        <div><dt className="text-xs font-bold text-[#647493]">Selisih total untuk diverifikasi</dt><dd className="mt-1 font-mono font-black text-[#0b1b43]">{idr(priceExposureAboveQ90(finding.metrics))}</dd></div>
                      </dl>
                      <p className="mt-3 text-xs leading-5 text-[#647493]">Kelompok pasar dibentuk dari {String(finding.metrics.comparator_count ?? "—")} harga pembanding dengan kategori dan konteks barang yang sama. Q50 adalah harga tengah; Q90 adalah batas yang hanya dilampaui sekitar 10% pembanding.</p>
                      <p className="mt-2 rounded-md bg-white px-3 py-2 font-mono text-xs font-bold text-[#0b1b43]">({idr(finding.metrics.quoted_or_hps_value)} − {idr(finding.metrics.q90)}) × {priceQuantity(finding.metrics)?.toLocaleString("id-ID") ?? "—"} unit = {idr(priceExposureAboveQ90(finding.metrics))}</p>
                      <p className="mt-2 text-xs leading-5 text-[#647493]">Nilai tersebut adalah selisih total terhadap Q90 untuk diverifikasi reviewer, bukan estimasi kerugian negara.</p>
                    </div>
                  )}

                  {module.engine === "GRAPH" && (
                    <div className="mt-4 rounded-lg border border-[#d7d9dd] bg-[#f7f7f6] p-4 text-sm text-[#4f5e77]">
                      <strong className="text-[#0b1b43]">{finding.subject_ids.join(" ↔ ")}</strong> mengikuti <strong>{String(finding.metrics.co_bid_count ?? "—")} tender</strong> bersama, dibanding ambang historis <strong>{String(finding.metrics.reference_threshold ?? "—")} tender</strong>. Ini menentukan prioritas pemeriksaan relasi, bukan membuktikan koordinasi.
                    </div>
                  )}

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#0b1b43]">Bukti</h4>
                      <ul className="mt-2 space-y-2">
                        {finding.evidence_locators.map((locator) => (
                          <li key={locator.locator_id} className="rounded-lg bg-[#f6f7f9] p-3 text-xs leading-5 text-[#4f5e77]">
                            <strong className="block text-[#17191d]">{locator.label}</strong>
                            <span className="font-mono">{locator.locator}</span>
                            <span className="mt-1 block">{locator.excerpt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-[#0b1b43]">Penjelasan alternatif</h4>
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-5 text-[#4f5e77]">
                        {finding.alternative_explanations.map((explanation) => (
                          <li key={explanation}>{explanation}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
