import "server-only";

import type {
  AnalysisJobContract,
  EngineDispatchMessage,
} from "@/lib/analysis/contracts";
import { buildFixtureEngineResults } from "@/lib/analysis/fixture-results";
import {
  buildGoldenAnalysisProgress,
  sequenceAnalysisTimeline,
  type AnalysisProgressEvent,
} from "@/lib/analysis-progress";
import { getGoldenCase } from "@/lib/golden-case";
import { getAnalysisEngineConfig } from "@/lib/env";

export interface AnalysisEngineGateway {
  dispatch(
    job: AnalysisJobContract,
    context: AnalysisDispatchContext,
  ): AsyncIterable<EngineDispatchMessage>;
}

export type AnalysisDispatchContext = {
  analysisCutoffAt: string;
};

function genericFixtureEvents(job: AnalysisJobContract) {
  let sequence = 0;
  const at = (
    delayMs: number,
    input: Omit<AnalysisProgressEvent, "schema_version" | "event_id" | "sequence" | "job_id" | "run_id" | "package_id" | "occurred_at">,
  ) => {
    sequence += 1;
    return {
      delayMs,
      event: {
        schema_version: "saring-analysis-progress-event-1.0.0" as const,
        event_id: `EVT:${job.run_id}:${sequence}`,
        sequence,
        job_id: job.job_id,
        run_id: job.run_id,
        package_id: job.package_id,
        occurred_at: new Date(Date.parse(job.created_at) + delayMs).toISOString(),
        ...input,
      },
    };
  };

  return sequenceAnalysisTimeline([
    at(250, { engine: null, event_type: "RUN_STARTED", stage: "SNAPSHOT_VALIDATION", status: "RUNNING", completed_units: null, total_units: null, unit_label: null, message: "Canonical snapshot locked and validated.", finding_count: null }),
    ...job.requested_engines.flatMap((engine, index) => [
      at(500 + index * 80, { engine, event_type: "ENGINE_STARTED", stage: engine === "PRICE" ? "NORMALIZING_OFFERS" : "CHECKING_DATA_QUALITY", status: "RUNNING", completed_units: 0, total_units: 1, unit_label: "snapshot", message: `${engine} fixture validation started.`, finding_count: null }),
      at(1050 + index * 80, { engine, event_type: "ENGINE_ABSTAINED", stage: "COMPLETE", status: "ABSTAINED", completed_units: 1, total_units: 1, unit_label: "snapshot", message: `${engine} requires the external analysis implementation for this package.`, finding_count: 0 }),
    ]),
    at(1800, { engine: null, event_type: "RUN_COMPLETED", stage: "COMPLETE", status: "COMPLETED", completed_units: null, total_units: null, unit_label: null, message: "Fixture run completed with explicit abstentions.", finding_count: null }),
  ], job.run_id);
}

export class FixtureAnalysisEngineGateway implements AnalysisEngineGateway {
  async *dispatch(
    job: AnalysisJobContract,
    context: AnalysisDispatchContext,
  ): AsyncIterable<EngineDispatchMessage> {
    const golden = getGoldenCase(job.package_id);
    const events = golden
      ? buildGoldenAnalysisProgress({
          packageId: job.package_id,
          packageName: golden.name,
          analysisCutoffAt: golden.analysisCutoffAt,
          runId: job.run_id,
          jobId: job.job_id,
          baseTime: job.created_at,
        }).timeline
      : genericFixtureEvents(job);
    const resultDelay = golden ? 9_200 : 1_700;
    const messages: EngineDispatchMessage[] = [
      ...events.map(({ delayMs, event }) => ({ kind: "progress" as const, delayMs, payload: event })),
      ...buildFixtureEngineResults(job, context.analysisCutoffAt).map((payload, index) => ({
        kind: "result" as const,
        delayMs: resultDelay + index,
        payload,
      })),
    ].sort((left, right) => left.delayMs - right.delayMs);
    for (const message of messages) yield message;
  }
}

let gateway: AnalysisEngineGateway | undefined;

export function getAnalysisEngineGateway() {
  if (gateway) return gateway;
  const config = getAnalysisEngineConfig();
  if (config.driver !== "fixture") {
    throw new Error("The pull-based analysis worker must claim jobs through the Worker API.");
  }
  gateway = new FixtureAnalysisEngineGateway();
  return gateway;
}
