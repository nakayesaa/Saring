import type { Metadata } from "next";
import {
  ArrowRight,
  Clock3,
  FileSearch,
  FolderOpen,
  ShieldAlert
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { PriorityLabel } from "@/components/priority-label";
import { PriorityPackagesTable } from "@/components/priority-packages-table";
import { GOLDEN_PACKAGE_ID } from "@/lib/demo-ids";
import { dashboardEngineSignals, dashboardMetrics, demoPackages } from "@/lib/fixtures/workspace";

export const metadata: Metadata = { title: "Review queue" };

const metricIcons = {
  packages: FolderOpen,
  review: ShieldAlert,
  evidence: FileSearch,
  time: Clock3,
} as const;

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Review queue"
        description="Packages ranked for human attention. Every signal remains traceable to source evidence and can abstain when data is insufficient."
        actions={
          <PrimaryActionLink href="/packages/new">Start review</PrimaryActionLink>
        }
      />

      <div className="shell-page-content">
        <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map(({ label, value, delta, icon }) => {
            const Icon = metricIcons[icon];
            return <article key={label} className="top-edge-highlight bg-[#0f1011] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-medium text-[#747982]">{label}</p>
                <Icon aria-hidden="true" size={14} strokeWidth={1.7} className="text-[#555a63]" />
              </div>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-[40px] font-semibold leading-none tracking-[-0.8px] text-[#f7f8f8]">{value}</p>
                <p className="pb-0.5 text-sm text-[#676c75]">{delta}</p>
              </div>
            </article>;
          })}
        </section>

        <section className="relative mt-6 overflow-hidden rounded-xl border-2 border-[#8f9aad] bg-white shadow-[0_16px_34px_-24px_rgb(11_27_67_/_58%),0_5px_12px_-8px_rgb(11_27_67_/_28%)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#c7ff00]" aria-hidden="true" />
          <div className="flex flex-col gap-5 border-b border-[#d7d9dd] px-5 pb-5 pt-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-4">
              <ShieldAlert className="mt-0.5 shrink-0 text-[#17191d]" size={32} strokeWidth={1.8} aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-[#17191d]">One package requires immediate review</h2>
                  <PriorityLabel priority="Critical" />
                </div>
                <p className="mt-2 max-w-3xl text-base leading-7 text-[#526383]">Price deviation and document similarity signals converge across independently cited sources.</p>
              </div>
            </div>
            <PrimaryActionLink href={`/packages/${GOLDEN_PACKAGE_ID}/findings`}>
              Open evidence <ArrowRight size={17} aria-hidden="true" />
            </PrimaryActionLink>
          </div>
          <div className="grid gap-px bg-[#d7d9dd] sm:grid-cols-3">
            {dashboardEngineSignals.map(({ title, detail, score }) => (
              <div key={title} className="bg-[#f7f7f6] px-5 py-4">
                <div className="flex items-center justify-between gap-4 text-base">
                  <span className="font-bold text-[#2d3f66]">{title}</span>
                  <span className="rounded-full bg-[#fff7bd] px-2.5 py-1 font-mono text-sm font-bold text-[#5f4b00]">{score}/100</span>
                </div>
                <p className="mt-1.5 text-sm text-[#647493]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <PriorityPackagesTable packages={demoPackages} />
      </div>
    </>
  );
}
