import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExtractionReviewPanel } from "@/components/extraction-review-workspace";
import { PageHeading } from "@/components/page-heading";
import { ReadinessEngineList } from "@/components/readiness-engine-list";
import { buildGoldenExtractionReview } from "@/lib/extraction-review";
import { buildCanonicalExtractionReview } from "@/lib/extraction-review";
import { buildAnalysisSnapshotExtractionReview } from "@/lib/extraction-review";
import { getGoldenCase } from "@/lib/golden-case";
import { buildCanonicalReadiness, buildGoldenReadiness } from "@/lib/readiness";
import { buildAnalysisSnapshotReadiness } from "@/lib/readiness";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { getPersistedCanonicalPackage } from "@/lib/intake/service";
import { DomainError } from "@/lib/errors";
import {
  CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT,
  type CanonicalAnalysisSnapshot,
} from "@/lib/intake/contracts";
import type { CanonicalSnapshot } from "@/lib/intake/validation";

export const metadata: Metadata = { title: "Analysis readiness" };

export default async function ReadinessPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  let readiness;
  let review;
  try {
    const persisted = await getPersistedCanonicalPackage(principal, packageId);
    if (persisted.contractVersion === CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT) {
      const snapshot = persisted.snapshot as CanonicalAnalysisSnapshot;
      readiness = buildAnalysisSnapshotReadiness(snapshot);
      review = buildAnalysisSnapshotExtractionReview(snapshot);
    } else {
      const snapshot = persisted.snapshot as CanonicalSnapshot;
      readiness = buildCanonicalReadiness(snapshot);
      review = buildCanonicalExtractionReview(snapshot);
    }
  } catch (error) {
    const item = getGoldenCase(packageId);
    if (!(error instanceof DomainError && error.code === "PACKAGE_NOT_FOUND") || !item) notFound();
    readiness = buildGoldenReadiness(item);
    review = buildGoldenExtractionReview(item);
  }

  return (
    <>
      <PageHeading
        title="Package is ready"
        description="The package passed manifest, provenance, and source-integrity checks. Confirm the extracted canonical fields below before analysis."
      />

      <div className="shell-page-content">
        <Link href="/packages/new" className="inline-flex items-center gap-2 text-sm font-bold text-[#647493] hover:text-[#1450e6]"><ArrowLeft size={17} /> Back to import</Link>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {readiness.summary.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#d7d9dd] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.07em] text-[#77869f]">{label}</p><p className="mt-2 text-base font-bold text-[#0b1b43]">{value}</p></div>
        ))}
      </section>

      <section className="mt-6">
        <div><h2 className="text-xl font-bold text-[#0b1b43]">Engine readiness</h2><p className="mt-1 text-sm font-medium text-[#647493]">Availability is measured independently for every engine.</p></div>
        <ReadinessEngineList checks={readiness.checks} />
      </section>

      <ExtractionReviewPanel review={review} />

      </div>
    </>
  );
}
