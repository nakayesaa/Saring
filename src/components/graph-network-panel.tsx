import type { AnalysisModuleView } from "@/lib/analysis-findings";

type NetworkEdge = {
  id: string;
  source: string;
  target: string;
  score: number;
  confidence: number;
  coBidCount: number | null;
  threshold: number | null;
};

function numericMetric(value: string | number | boolean | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function graphEdges(module: AnalysisModuleView): NetworkEdge[] {
  return module.findings.flatMap((finding) => {
    if (finding.scope !== "CROSS_VENDOR" || finding.subject_ids.length < 2) return [];
    return [{
      id: finding.finding_id,
      source: finding.subject_ids[0],
      target: finding.subject_ids[1],
      score: finding.score ?? 0,
      confidence: finding.confidence,
      coBidCount: numericMetric(finding.metrics.co_bid_count),
      threshold: numericMetric(finding.metrics.reference_threshold),
    }];
  });
}

function shortLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 15)}…` : value;
}

export function GraphNetworkPanel({ module }: { module: AnalysisModuleView }) {
  const edges = graphEdges(module);
  const nodes = [...new Set(edges.flatMap((edge) => [edge.source, edge.target]))];

  if (edges.length === 0) {
    return (
      <section className="mt-7 rounded-xl border border-[#c9cdd4] bg-white p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#647493]">Network view</p>
        <h2 className="mt-2 text-xl font-extrabold text-[#0b1b43]">Belum ada edge yang layak divisualisasikan</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f5e77]">
          {module.summary} Visualisasi sengaja tidak membentuk hubungan tanpa finding lintas vendor yang diterbitkan engine.
        </p>
      </section>
    );
  }

  const positions = new Map(nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
    return [node, { x: 300 + Math.cos(angle) * 190, y: 190 + Math.sin(angle) * 125 }] as const;
  }));

  return (
    <section className="mt-7 overflow-hidden rounded-xl border border-[#c9cdd4] bg-white">
      <div className="border-b border-[#e4e7ec] px-6 py-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#647493]">Network view</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#0b1b43]">Relasi partisipasi berulang</h2>
            <p className="mt-1 text-sm text-[#4f5e77]">Edge hanya berasal dari finding Graph Engine yang tersimpan.</p>
          </div>
          <p className="font-mono text-xs font-bold text-[#647493]">{nodes.length} vendor · {edges.length} edge</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div className="min-h-[390px] bg-[radial-gradient(circle_at_center,#f8faff_0,#eef3ff_55%,#e5ebf7_100%)] p-4">
          <svg viewBox="0 0 600 380" className="h-full min-h-[350px] w-full" role="img" aria-label="Graph relasi vendor">
            {edges.map((edge) => {
              const source = positions.get(edge.source)!;
              const target = positions.get(edge.target)!;
              const width = 2 + edge.score * 6;
              return (
                <g key={edge.id}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#1450e6" strokeWidth={width} strokeLinecap="round" opacity="0.58" />
                  <circle cx={(source.x + target.x) / 2} cy={(source.y + target.y) / 2} r="18" fill="#0b1b43" />
                  <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
                    {edge.coBidCount ?? "!"}
                  </text>
                </g>
              );
            })}
            {nodes.map((node) => {
              const point = positions.get(node)!;
              return (
                <g key={node}>
                  <circle cx={point.x} cy={point.y} r="42" fill="white" stroke="#1450e6" strokeWidth="4" />
                  <circle cx={point.x} cy={point.y - 8} r="9" fill="#1450e6" opacity="0.9" />
                  <text x={point.x} y={point.y + 15} textAnchor="middle" fill="#0b1b43" fontSize="12" fontWeight="800">
                    {shortLabel(node)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="border-t border-[#e4e7ec] p-5 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-extrabold text-[#0b1b43]">Edge evidence</h3>
          <div className="mt-3 space-y-3">
            {edges.map((edge) => (
              <article key={edge.id} className="rounded-lg bg-[#f6f7f9] p-4">
                <p className="font-mono text-xs font-black text-[#1450e6]">{edge.source} ↔ {edge.target}</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-[#647493]">Co-bid</dt><dd className="mt-1 font-mono font-black text-[#17191d]">{edge.coBidCount ?? "—"}</dd></div>
                  <div><dt className="text-[#647493]">Threshold</dt><dd className="mt-1 font-mono font-black text-[#17191d]">{edge.threshold ?? "—"}</dd></div>
                  <div><dt className="text-[#647493]">Score</dt><dd className="mt-1 font-mono font-black text-[#17191d]">{Math.round(edge.score * 100)}%</dd></div>
                  <div><dt className="text-[#647493]">Confidence</dt><dd className="mt-1 font-mono font-black text-[#17191d]">{Math.round(edge.confidence * 100)}%</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#647493]">Ketebalan garis menunjukkan score relatif, bukan kekuatan bukti hukum atau probabilitas kolusi.</p>
        </div>
      </div>
    </section>
  );
}
