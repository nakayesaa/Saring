import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Database, FileArchive, Workflow } from "lucide-react";
import { IngestionStatusSync } from "@/components/ingestion-status-sync";
import { PageHeading } from "@/components/page-heading";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { requireWorkspaceSession } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { getLatestIngestionJob } from "@/lib/intake/status";

export const metadata: Metadata = { title: "Package ingestion" };

function formatBytes(bytes: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

export default async function IngestionPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const principal = await resolveWorkspacePrincipal(await requireWorkspaceSession());
  let ingestion;
  try {
    ingestion = await getLatestIngestionJob(principal, packageId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "INGESTION_JOB_NOT_FOUND") notFound();
    throw error;
  }

  if (ingestion.status === "COMPLETED" || ingestion.status === "NEEDS_REVIEW") {
    redirect(`/packages/${encodeURIComponent(packageId)}/readiness`);
  }

  const queued = ingestion.status === "QUEUED";
  const active = ["QUEUED", "CLAIMED", "RUNNING"].includes(ingestion.status);
  const failed = ingestion.status === "FAILED" || ingestion.status === "CANCELLED";
  return (
    <>
      <IngestionStatusSync active={active} />
      <PageHeading
        title={failed ? "Package ingestion stopped" : queued ? "Bundle queued for ingestion" : "Package ingestion in progress"}
        description={failed
          ? "The worker stopped safely without publishing a canonical snapshot. The persisted run remains available for diagnosis and retry."
          : "The immutable evidence bundle is stored privately. The Python worker can now claim this exact snapshot for validation, parsing, OCR fallback, and canonical extraction."}
      />
      <div className="shell-page-content">
        <Link href="/packages/new" className="inline-flex items-center gap-2 text-sm font-bold text-[#647493] hover:text-[#1450e6]">
          <ArrowLeft size={17} /> Back to import
        </Link>

        <section className="mt-6 overflow-hidden rounded-xl border border-[#b8bbc2] bg-white shadow-[0_14px_34px_-26px_rgb(11_27_67_/_42%)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 p-6 sm:p-8">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#eef3ff] text-[#1450e6]">
                  <FileArchive size={24} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-[#0b1b43]">{ingestion.fileName}</h2>
                  <p className="mt-1 text-sm font-medium text-[#647493]">
                    {formatBytes(ingestion.byteSize)} MB · cutoff {ingestion.analysisCutoffAt}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: CheckCircle2, label: "Private upload", value: "Verified" },
                  { icon: Database, label: "Database record", value: "Persisted" },
                  { icon: Workflow, label: "Python ingestion", value: queued ? "Queued" : ingestion.stage.replaceAll("_", " ") },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 border-t border-[#e5e6e8] pt-4">
                    <Icon className="shrink-0 text-[#1450e6]" size={20} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#647493]">{label}</p>
                      <p className="truncate text-base font-bold text-[#0b1b43]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="flex min-w-[250px] flex-col justify-center border-t border-[#d7d9dd] bg-[#f5f5f4] px-6 py-6 lg:border-l lg:border-t-0">
              <p className="text-sm font-semibold text-[#647493]">Ingestion run</p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-[#0b1b43]">{ingestion.runId}</p>
              <p className="mt-4 text-sm leading-6 text-[#647493]">Readiness becomes available only after a contract-valid canonical snapshot is produced.</p>
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}
