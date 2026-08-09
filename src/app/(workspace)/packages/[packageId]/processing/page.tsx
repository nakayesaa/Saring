import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisProcessing } from "@/components/analysis-processing";
import { getLatestAnalysisJob } from "@/lib/analysis/service";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { buildGoldenAnalysisProgress } from "@/lib/analysis-progress";
import { getGoldenCase } from "@/lib/golden-case";

export const metadata: Metadata = { title: "Run analysis" };

export default async function ProcessingPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  let analysis;
  let liveEndpoint: string | undefined;

  try {
    const state = await getLatestAnalysisJob(principal, packageId);
    analysis = {
      packageId,
      packageName: state.packageName,
      runId: state.job.run_id,
      jobId: state.job.job_id,
      analysisCutoffAt: state.analysisCutoffAt,
      requestedEngines: state.job.requested_engines,
      timeline: state.events.map((event) => ({ delayMs: 0, event })),
    };
    liveEndpoint = `/api/packages/${encodeURIComponent(packageId)}/analysis`;
  } catch (error) {
    const item = getGoldenCase(packageId);
    if (error instanceof DomainError && error.code === "JOB_NOT_FOUND" && item) {
      analysis = buildGoldenAnalysisProgress({ packageId: item.id, packageName: item.name, analysisCutoffAt: item.analysisCutoffAt });
    } else {
      notFound();
    }
  }
  return <AnalysisProcessing analysis={analysis} liveEndpoint={liveEndpoint} />;
}
