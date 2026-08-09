"use client";

import { ArrowRight, Check } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { PrimaryActionLink } from "@/components/primary-action-link";
import { ProgressBar } from "@/components/progress-bar";
import { primaryAnalysisEngines, supportingAnalysisEngines } from "@/lib/analysis-progress";
import type {
  AnalysisEngine,
  AnalysisProcessingViewModel,
  AnalysisProgressEvent,
  AnalysisProgressStatus,
} from "@/lib/analysis-progress";

type EngineUiState = {
  status: AnalysisProgressStatus;
  stage: string;
  message: string;
  completedUnits: number | null;
  totalUnits: number | null;
  unitLabel: string | null;
  findingCount: number | null;
};

type ProcessingState = {
  runStatus: AnalysisProgressStatus;
  runStage: string;
  runMessage: string;
  engines: Record<AnalysisEngine, EngineUiState>;
};

type ProcessingAction =
  | { type: "RESET" }
  | { type: "SYNC"; events: AnalysisProgressEvent[] }
  | { type: "EVENT"; event: AnalysisProgressEvent };

function queuedEngine(): EngineUiState {
  return {
    status: "QUEUED",
    stage: "QUEUED",
    message: "Waiting for the canonical snapshot.",
    completedUnits: null,
    totalUnits: null,
    unitLabel: null,
    findingCount: null,
  };
}

function initialState(): ProcessingState {
  return {
    runStatus: "QUEUED",
    runStage: "QUEUED",
    runMessage: "Preparing analysis run.",
    engines: {
      PRICE: queuedEngine(),
      DOCUMENT: queuedEngine(),
      GRAPH: queuedEngine(),
      TECHNICAL: queuedEngine(),
      COMPLETENESS: queuedEngine(),
      DATA_QUALITY: queuedEngine(),
      FUSION: queuedEngine(),
    },
  };
}

function reducer(state: ProcessingState, action: ProcessingAction): ProcessingState {
  if (action.type === "RESET") return initialState();
  if (action.type === "SYNC") {
    return action.events.reduce(
      (current, event) => reducer(current, { type: "EVENT", event }),
      initialState(),
    );
  }

  const event = action.event;
  if (!event.engine) {
    return {
      ...state,
      runStatus: event.status,
      runStage: event.stage,
      runMessage: event.message,
    };
  }

  return {
    ...state,
    engines: {
      ...state.engines,
      [event.engine]: {
        status: event.status,
        stage: event.stage,
        message: event.message,
        completedUnits: event.completed_units,
        totalUnits: event.total_units,
        unitLabel: event.unit_label,
        findingCount: event.finding_count,
      },
    },
  };
}

function engineProgress(engine: EngineUiState) {
  if (["COMPLETED", "WARNING", "ABSTAINED", "FAILED"].includes(engine.status)) return 100;
  if (engine.completedUnits === null || engine.totalUnits === null) return 0;
  return Math.min(100, Math.round((engine.completedUnits / engine.totalUnits) * 100));
}

function statusLabel(status: AnalysisProgressStatus) {
  const labels: Record<AnalysisProgressStatus, string> = {
    QUEUED: "Queued",
    RUNNING: "Analyzing",
    COMPLETED: "Completed",
    WARNING: "Completed with warning",
    ABSTAINED: "Abstained",
    FAILED: "Failed",
  };
  return labels[status];
}

function statusClass(status: AnalysisProgressStatus) {
  if (status === "COMPLETED") return "text-[#168b55]";
  if (status === "WARNING" || status === "ABSTAINED") return "text-[#a56800]";
  if (status === "FAILED") return "text-[#d64a3f]";
  if (status === "RUNNING") return "text-[#1450e6]";
  return "text-[#77869f]";
}

function stageLabel(stage: string) {
  return stage.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function RunProgressRail({ value, complete }: { value: number; complete: boolean }) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const indicatorPosition = Math.max(2, Math.min(98, normalizedValue));

  return (
    <div role="progressbar" aria-label="Overall analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalizedValue}>
      <svg className="block h-3 w-full overflow-visible" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="run-progress-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1450e6" />
            <stop offset="72%" stopColor="#5c8cff" />
            <stop offset="100%" stopColor="#c7ff00" />
          </linearGradient>
        </defs>
        <rect x="0" y="2.5" width="100" height="3" rx="1.5" fill="#dfe4ed" />
        <rect x="0" y="2.5" width={normalizedValue} height="3" rx="1.5" fill="url(#run-progress-gradient)" />
        <circle cx={indicatorPosition} cy="4" r="2.1" fill="#c7ff00" stroke="#0b1b43" strokeWidth="0.7" className={complete ? "" : "animate-pulse"} />
      </svg>
    </div>
  );
}

export function AnalysisProcessing({
  analysis,
  liveEndpoint,
}: {
  analysis: AnalysisProcessingViewModel;
  liveEndpoint?: string;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [activeEngineIndex, setActiveEngineIndex] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (liveEndpoint) return;
    dispatch({ type: "RESET" });
    const timers = analysis.timeline.map(({ delayMs, event }) =>
      window.setTimeout(() => dispatch({ type: "EVENT", event }), delayMs),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [analysis.timeline, liveEndpoint]);

  useEffect(() => {
    if (!liveEndpoint) return;
    let cancelled = false;
    let timer: number | undefined;

    async function sync() {
      try {
        const response = await fetch(liveEndpoint as string, { cache: "no-store" });
        if (!response.ok) throw new Error("Analysis progress is temporarily unavailable.");
        const data = await response.json() as {
          job: { status: string };
          events: AnalysisProgressEvent[];
        };
        if (cancelled) return;
        dispatch({ type: "SYNC", events: data.events });
        setSyncError(null);
        if (!["COMPLETED", "NEEDS_REVIEW", "FAILED", "ABSTAINED", "CANCELLED"].includes(data.job.status)) {
          timer = window.setTimeout(sync, 1_000);
        }
      } catch (error) {
        if (cancelled) return;
        setSyncError(error instanceof Error ? error.message : "Analysis progress is temporarily unavailable.");
        timer = window.setTimeout(sync, 3_000);
      }
    }

    dispatch({ type: "SYNC", events: analysis.timeline.map(({ event }) => event) });
    void sync();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [analysis.timeline, liveEndpoint]);

  const activePrimaryEngines = useMemo(
    () => primaryAnalysisEngines.filter(({ key }) => analysis.requestedEngines.includes(key)),
    [analysis.requestedEngines],
  );
  const activeSupportingEngines = useMemo(
    () => supportingAnalysisEngines.filter(({ key }) => analysis.requestedEngines.includes(key)),
    [analysis.requestedEngines],
  );
  const overallProgress = useMemo(() => {
    const progress = analysis.requestedEngines.map((engine) => engineProgress(state.engines[engine]));
    if (!progress.length) return 0;
    return Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length);
  }, [analysis.requestedEngines, state.engines]);

  const complete = state.runStatus === "COMPLETED";
  const findingCount = Object.values(state.engines).reduce(
    (total, engine) => total + (engine.findingCount ?? 0),
    0,
  );
  const activeDefinition = activePrimaryEngines[activeEngineIndex] ?? activePrimaryEngines[0] ?? primaryAnalysisEngines[0];
  const activeEngine = state.engines[activeDefinition.key];
  const activeProgress = engineProgress(activeEngine);

  useEffect(() => {
    if (complete || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(
      () => setActiveEngineIndex((current) => (current + 1) % activePrimaryEngines.length),
      2800,
    );
    return () => window.clearInterval(interval);
  }, [activePrimaryEngines.length, complete]);

  return (
    <>
      <PageHeading
        title={complete ? "Analysis complete" : "Analyzing package evidence"}
        description={complete ? `${findingCount} source-linked findings are ready for human review.` : state.runStatus === "FAILED" ? "The run stopped safely. Its persisted events remain available for diagnosis and retry." : `${analysis.requestedEngines.length} analysis engine${analysis.requestedEngines.length === 1 ? " is" : "s are"} evaluating the immutable canonical snapshot.`}
        actions={complete ? (
          <PrimaryActionLink href={`/packages/${analysis.packageId}/findings`} pendingLabel="Opening findings…">
            Tinjau temuan <ArrowRight size={17} aria-hidden="true" />
          </PrimaryActionLink>
        ) : null}
      />

      <div className="shell-page-content">
        {syncError ? (
          <p role="status" className="mb-4 rounded-lg border border-[#e0b254] bg-[#fff9e8] px-4 py-3 text-sm font-bold text-[#73500a]">
            {syncError} Retrying automatically…
          </p>
        ) : null}
        <section className="rounded-xl border border-[#d7d9dd] bg-white px-4 py-3.5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[20px] font-extrabold uppercase tracking-[0.08em] text-[#77869f]">Analysis run</span>
                <span className="font-mono text-sm font-black tracking-[-0.02em] text-[#17191d]">{analysis.runId}</span>
                <span className={`text-base font-extrabold uppercase tracking-[0.07em] ${statusClass(state.runStatus)}`}>{statusLabel(state.runStatus)}</span>
              </div>
              <p key={state.runMessage} className="analysis-message-enter mt-1.5 text-xs font-semibold text-[#526383]">{state.runMessage}</p>
              <p className="mt-1 text-base font-medium text-[#8a98b0]">Cutoff · {analysis.analysisCutoffAt}</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-base font-extrabold uppercase tracking-[0.07em] text-[#77869f]">{stageLabel(state.runStage)}</p>
                <p className="font-mono text-lg font-black leading-none tracking-[-0.04em] text-[#17191d]">{overallProgress}<span className="ml-0.5 text-base text-[#647493]">%</span></p>
              </div>
              <RunProgressRail value={overallProgress} complete={complete} />
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[22px] border-2 border-[#0b1b43] bg-[#0b1b43] p-4 shadow-[0_26px_58px_-34px_rgb(11_27_67_/_72%)] sm:p-5" aria-label="Primary intelligence engines">
          <div className="flex flex-col gap-3 px-1 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-extrabold text-white">Analysis engines</h2><p className="mt-1 text-sm font-medium text-[#aebbd3]">Only engines requested for this run are shown.</p></div>
            <p className="text-xs font-semibold text-[#aebbd3]">Select an engine to view progress</p>
          </div>

          <div className="grid gap-2.5 md:grid-cols-3" role="tablist" aria-label="Choose analysis engine">
            {activePrimaryEngines.map((definition, index) => {
              const engine = state.engines[definition.key];
              const progress = engineProgress(engine);
              const active = index === activeEngineIndex;
              return (
                <button
                  key={definition.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveEngineIndex(index)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${active ? "border-white bg-white text-[#17191d] shadow-[0_12px_24px_-18px_rgb(0_0_0_/_55%)]" : "border-white/15 bg-[#142957] text-white hover:border-white/35 hover:bg-[#183164]"}`}
                >
                  <span className="flex items-center justify-between gap-3"><span className={`font-mono text-xs font-black ${active ? "text-[#77869f]" : "text-[#91a2c3]"}`}>{definition.number}</span><span className={`text-base font-extrabold uppercase tracking-[0.07em] ${active ? statusClass(engine.status) : engine.status === "RUNNING" ? "text-[#c7ff00]" : "text-[#c2cce0]"}`}>{statusLabel(engine.status)}</span></span>
                  <span className="mt-2 block truncate text-sm font-extrabold">{definition.title}</span>
                  <svg className="mt-3 block h-1 w-full" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
                    <rect width="100" height="4" rx="2" fill={active ? "#e5e6e8" : "#294478"} />
                    <rect width={progress} height="4" rx="2" fill="#c7ff00" />
                  </svg>
                </button>
              );
            })}
          </div>

          <article key={activeDefinition.key} role="tabpanel" aria-live="polite" className="analysis-carousel-enter relative mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_18px_42px_-26px_rgb(0_0_0_/_65%)]">
            {activeEngine.status === "RUNNING" ? <div className="analysis-running-track absolute inset-x-0 top-0 z-10 h-1 bg-[#e6edff]" aria-hidden="true"><span /></div> : null}
            <div className="grid min-h-[330px] lg:grid-cols-[minmax(0,1fr)_230px]">
              <div className="flex flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-mono text-xs font-black text-[#9ca3ad]">ENGINE {activeDefinition.number}</p><h3 className="mt-3 text-[28px] font-extrabold tracking-[-0.025em] text-[#17191d]">{activeDefinition.title}</h3></div>
                  <span className={`shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] ${statusClass(activeEngine.status)}`}>{statusLabel(activeEngine.status)}</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#647493]">{activeDefinition.description}</p>

                <div className="my-auto py-7">
                  <p className="text-xs font-extrabold uppercase tracking-[0.09em] text-[#1450e6]">{stageLabel(activeEngine.stage)}</p>
                  <p key={activeEngine.message} className="analysis-message-enter mt-3 max-w-2xl text-xl font-extrabold leading-8 text-[#2d3f66]">{activeEngine.message}</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs font-bold text-[#647493]">
                    <span>{activeEngine.completedUnits !== null && activeEngine.totalUnits !== null ? `${activeEngine.completedUnits}/${activeEngine.totalUnits} ${activeEngine.unitLabel ?? "items"}` : "Waiting for engine capacity"}</span>
                    <span>{activeProgress}%</span>
                  </div>
                  <ProgressBar value={activeProgress} tone={activeEngine.status === "COMPLETED" ? "success" : activeEngine.status === "WARNING" ? "warning" : "accent"} />
                </div>
              </div>

              <div className={`flex flex-col justify-between p-6 transition-colors sm:p-7 ${activeEngine.status === "QUEUED" ? "bg-[#eef0f3]" : "bg-[#c7ff00]"}`}>
                <div><p className="text-xs font-extrabold uppercase tracking-[0.09em] text-[#526383]">Engine progress</p><p className="mt-3 font-mono text-[56px] font-black leading-none tracking-[-0.09em] text-[#0b1b43]">{activeProgress}<span className="ml-1 text-xl">%</span></p></div>
                <div className="mt-10 border-t border-[#0b1b43]/20 pt-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#526383]">Current output</p>
                  <p className="mt-2 text-lg font-extrabold text-[#0b1b43]">{activeEngine.findingCount === null ? "Evidence pending" : `${activeEngine.findingCount} cited ${activeEngine.findingCount === 1 ? "finding" : "findings"}`}</p>
                </div>
              </div>
            </div>
          </article>
        </section>

        {activeSupportingEngines.length ? <section className="mt-5 rounded-lg border border-[#d7d9dd] bg-white px-4 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-sm font-extrabold text-[#17191d]">Supporting checks</h2><p className="mt-0.5 text-xs font-medium text-[#647493]">Deterministic safeguards running in parallel.</p></div>
            <div className="flex flex-wrap gap-2">
              {activeSupportingEngines.map(({ key, title }) => {
                const engine = state.engines[key];
                return (
                  <div key={key} className="flex min-w-[158px] items-center gap-2 rounded-md bg-[#f7f7f6] px-3 py-2">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full ${engine.status === "COMPLETED" ? "bg-[#168b55] text-white" : engine.status === "WARNING" ? "bg-[#fff0b8] text-[#7b650c]" : engine.status === "RUNNING" ? "bg-[#c7ff00] text-[#0b1b43] animate-pulse" : "bg-[#e5e6e8] text-[#77869f]"}`}>
                      {engine.status === "COMPLETED" ? <Check size={12} strokeWidth={2.5} /> : <span className="size-1 rounded-full bg-current" />}
                    </span>
                    <span><span className="block text-xs font-extrabold text-[#17191d]">{title}</span><span className={`block text-base font-bold ${statusClass(engine.status)}`}>{statusLabel(engine.status)}</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </section> : null}

      </div>
    </>
  );
}
