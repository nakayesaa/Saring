import "server-only";

import {
  projectAnalysisFindings,
} from "@/lib/analysis-findings";
import { getLatestAnalysisResults } from "@/lib/analysis/service";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";

export async function getAnalysisFindingsView(packageId: string) {
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  try {
    return projectAnalysisFindings(await getLatestAnalysisResults(principal, packageId));
  } catch (error) {
    if (error instanceof DomainError && ["JOB_NOT_FOUND", "ANALYSIS_NOT_COMPLETE"].includes(error.code)) {
      return null;
    }
    throw error;
  }
}
