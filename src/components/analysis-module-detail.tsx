import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import type { AnalysisModuleView } from "@/lib/analysis-findings";

const statusLabel: Record<AnalysisModuleView["status"], string> = {
  SCORED: "Scored",
  LOW_CONFIDENCE: "Low confidence",
  ABSTAINED: "Abstained",
  NOT_APPLICABLE: "Not applicable",
};

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function AnalysisModuleDetail({
  packageId,
  packageName,
  title,
  description,
  module,
}: {
  packageId: string;
  packageName: string;
  title: string;
  description: string;
  module: AnalysisModuleView;
}) {
  return (
    <div className="contents">
      <PageHeading title={title} description={description} />
      <div className="shell-page-content">
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
                <dt className="text-xs font-bold text-[#afbdd7]">Score</dt>
                <dd className="mt-1 font-mono text-xl font-black">{percent(module.score)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#afbdd7]">Confidence</dt>
                <dd className="mt-1 font-mono text-xl font-black">{percent(module.confidence)}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-4 font-mono text-xs text-[#afbdd7]">
            {module.engine_version} · {module.model_version ?? "deterministic-rules"}
          </p>
        </section>

        <section className="mt-7">
          <h2 className="text-2xl font-extrabold text-[#0b1b43]">Evidence-linked signals</h2>
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
                      <p className="text-xs font-bold uppercase tracking-wide text-[#647493]">{finding.scope}</p>
                      <h3 className="mt-1 text-lg font-extrabold text-[#0b1b43]">{finding.title}</h3>
                    </div>
                    <span className="rounded-full bg-[#eef3ff] px-3 py-1 font-mono text-xs font-bold text-[#1450e6]">
                      {finding.metric}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#4f5e77]">{finding.summary}</p>

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
