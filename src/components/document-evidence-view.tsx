import Link from "next/link";
import { ArrowLeft, FileDiff, TextSearch } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import type {
  AnalysisEvidenceLocatorView,
  AnalysisFindingView,
  AnalysisModuleView,
} from "@/lib/analysis-findings";
import { findingPresentation } from "@/lib/analysis-findings";

const metricLabels: Record<string, string> = {
  attribute: "Atribut",
  relation: "Relasi",
  review_decision: "Keputusan model",
  reason_code: "Alasan",
  predictor: "Predictor",
  retrieval_score: "Retrieval score",
};

const visibleMetricKeys = Object.keys(metricLabels);

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function metricValue(key: string, value: string | number | boolean | null) {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (key === "retrieval_score" && typeof value === "number" && value >= 0 && value <= 1) return percent(value);
  return String(value).replaceAll("_", " ");
}

function bboxLabel(bbox: AnalysisEvidenceLocatorView["bbox"]) {
  return bbox ? `[${bbox.map((coordinate) => Number(coordinate.toFixed(2))).join(", ")}]` : "Tidak tersedia";
}

function FindingIcon({ type }: { type: string }) {
  const Icon = type === "CROSS_DOCUMENT_FACT_CONTRADICTION" ? FileDiff : TextSearch;
  return <Icon className="shrink-0 text-[#1450e6]" size={26} strokeWidth={2.2} aria-hidden="true" />;
}

function EvidenceRegion({ evidence, index }: { evidence: AnalysisEvidenceLocatorView; index: number }) {
  return (
    <section className="min-w-0 px-5 py-5 sm:px-6" aria-label={`Sumber dokumen ${index + 1}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[#0b1b43]">Sumber {index + 1} · {evidence.label}</p>
          <p className="mt-1 break-all font-mono text-xs font-bold text-[#647493]">
            {evidence.document_id ?? evidence.source}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-[#2d3f66]">
          {evidence.page_number ? `Halaman ${evidence.page_number}` : evidence.locator}
        </span>
      </div>

      <blockquote className="mt-4 [overflow-wrap:anywhere] text-base font-semibold leading-7 text-[#2d3f66]">
        <mark className="box-decoration-clone bg-[#fff0a8] px-1 text-inherit">{evidence.excerpt}</mark>
      </blockquote>

      <dl className="mt-5 grid gap-3 border-t border-[#e1e3e7] pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="min-w-0">
          <dt className="text-xs font-bold text-[#77869f]">Koordinat kutipan pada PDF</dt>
          <dd className="mt-1 break-all font-mono text-sm font-black text-[#0b1b43]">{bboxLabel(evidence.bbox)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-bold text-[#77869f]">ID sumber bukti</dt>
          <dd className="mt-1 break-all font-mono text-sm font-black text-[#0b1b43]">{evidence.locator_id}</dd>
        </div>
      </dl>
    </section>
  );
}

function FindingMetrics({ finding }: { finding: AnalysisFindingView }) {
  const metrics = visibleMetricKeys.flatMap((key) => {
    const value = finding.metrics[key];
    return value === undefined ? [] : [{ key, value }];
  });
  if (!metrics.length) return null;

  return (
    <dl className="grid border-y border-[#d7d9dd] sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(({ key, value }) => (
        <div key={key} className="min-w-0 border-b border-[#e5e6e8] px-5 py-4 last:border-b-0 sm:px-6 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
          <dt className="text-xs font-bold text-[#77869f]">{metricLabels[key]}</dt>
          <dd className="mt-1 [overflow-wrap:anywhere] text-sm font-extrabold text-[#0b1b43]">{metricValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentFinding({ finding }: { finding: AnalysisFindingView }) {
  const presentation = findingPresentation[finding.finding_type as keyof typeof findingPresentation];
  const isContradiction = finding.finding_type === "CROSS_DOCUMENT_FACT_CONTRADICTION";

  return (
    <article className="overflow-hidden rounded-xl border border-[#b8bbc2] bg-white shadow-[0_14px_34px_-28px_rgba(11,27,67,0.75)]">
      <header className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <FindingIcon type={finding.finding_type} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#0b1b43]">{finding.title}</h2>
                <span className="font-mono text-xs font-bold text-[#77869f]">{finding.finding_id}</span>
              </div>
              <p className="mt-2 max-w-[72ch] text-base font-semibold leading-7 text-[#526383]">{finding.summary}</p>
              <p className="mt-2 max-w-[72ch] text-sm font-semibold leading-6 text-[#647493]">
                {presentation?.description ?? "Sinyal dokumen ini perlu ditelusuri kembali ke sumber sebelum reviewer mengambil tindakan."}
              </p>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-xs font-bold text-[#77869f]">Kecukupan bukti</p>
            <p className="mt-1 font-mono text-xl font-black text-[#0b1b43]">{percent(finding.confidence)}</p>
          </div>
        </div>
      </header>

      <FindingMetrics finding={finding} />

      <div className={`grid divide-y divide-[#d7d9dd] ${finding.evidence_locators.length > 1 ? "lg:grid-cols-2 lg:divide-x lg:divide-y-0" : ""}`}>
        {finding.evidence_locators.map((evidence, index) => (
          <EvidenceRegion key={evidence.locator_id} evidence={evidence} index={index} />
        ))}
      </div>

      <footer className="border-t border-[#d7d9dd] bg-[#f7f7f6] px-5 py-4 sm:px-6">
        {finding.alternative_explanations.length > 0 && (
          <p className="text-sm font-semibold leading-6 text-[#526383]">
            <strong className="font-extrabold text-[#0b1b43]">Penjelasan alternatif:</strong>{" "}
            {finding.alternative_explanations.join(" · ")}
          </p>
        )}
        {isContradiction && (
          <p className="mt-2 text-sm font-extrabold text-[#73500a]">
            Temuan ini menunjukkan inkonsistensi yang memerlukan review, bukan kesimpulan pelanggaran.
          </p>
        )}
      </footer>
    </article>
  );
}

export function DocumentEvidenceView({
  packageId,
  packageName,
  runId,
  cutoff,
  module,
}: {
  packageId: string;
  packageName: string;
  runId: string;
  cutoff: string;
  module: AnalysisModuleView;
}) {
  return (
    <div className="contents">
      <PageHeading
        title="Bukti dokumen"
        description="Bandingkan kutipan dan lokasi PDF yang mendasari setiap inkonsistensi. Keputusan akhir tetap berada pada reviewer."
      />

      <div className="shell-page-content">
        <Link href={`/packages/${packageId}/findings`} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#647493] transition hover:text-[#1450e6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1450e6]">
          <ArrowLeft size={17} aria-hidden="true" /> Kembali ke ringkasan temuan
        </Link>

        <section className="mb-6 grid gap-4 border-y border-[#b8bbc2] py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" aria-label="Identitas hasil Document Engine">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-[#0b1b43]">{packageName}</h2>
            <p className="mt-1 max-w-[72ch] text-sm font-semibold leading-6 text-[#647493]">{module.summary}</p>
          </div>
          <dl className="flex flex-wrap gap-x-7 gap-y-3 text-sm">
            <div>
              <dt className="font-bold text-[#77869f]">Engine</dt>
              <dd className="mt-1 font-mono font-black text-[#0b1b43]">{module.engine_version}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#77869f]">Run</dt>
              <dd className="mt-1 font-mono font-black text-[#0b1b43]">{runId}</dd>
            </div>
            <div>
              <dt className="font-bold text-[#77869f]">Cutoff</dt>
              <dd className="mt-1 font-mono font-black text-[#0b1b43]">{cutoff}</dd>
            </div>
          </dl>
        </section>

        {module.findings.length > 0 ? (
          <div className="space-y-6">
            {module.findings.map((finding) => <DocumentFinding key={finding.finding_id} finding={finding} />)}
          </div>
        ) : (
          <section className="rounded-xl border border-[#d7d9dd] bg-white px-6 py-12 text-center">
            <TextSearch className="mx-auto text-[#647493]" size={28} aria-hidden="true" />
            <h2 className="mt-4 text-xl font-extrabold text-[#0b1b43]">Tidak ada temuan dokumen</h2>
            <p className="mx-auto mt-2 max-w-[60ch] text-sm font-semibold leading-6 text-[#647493]">Document Engine tidak mengembalikan inkonsistensi yang perlu ditampilkan untuk run ini.</p>
          </section>
        )}
      </div>
    </div>
  );
}
