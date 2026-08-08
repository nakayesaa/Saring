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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export class HttpAnalysisEngineGateway implements AnalysisEngineGateway {
  constructor(
    private readonly url: URL,
    private readonly token: string,
    private readonly callbackToken: string,
    private readonly appBaseUrl: URL,
  ) {}

  async *dispatch(
    job: AnalysisJobContract,
    context: AnalysisDispatchContext,
  ): AsyncIterable<EngineDispatchMessage> {
    void context;
    const location = new URL(job.canonical_snapshot_location);
    if (location.protocol !== "supabase:" || location.hostname !== "evidence") {
      throw new Error("Unsupported canonical snapshot location.");
    }
    const objectKey = location.pathname.replace(/^\//, "");
    const { data, error } = await createSupabaseAdminClient()
      .storage.from("evidence")
      .createSignedUrl(objectKey, 300);
    if (error || !data) throw new Error("Unable to sign the canonical snapshot.");

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        job,
        canonical_snapshot: { url: data.signedUrl, expires_in_seconds: 300 },
        callbacks: {
          progress: new URL(`/api/worker/jobs/${job.job_id}/progress`, this.appBaseUrl).toString(),
          result: new URL(`/api/worker/jobs/${job.job_id}/results`, this.appBaseUrl).toString(),
          bearer_token: this.callbackToken,
        },
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Analysis engine rejected the job with status ${response.status}.`);
  }
}

let gateway: AnalysisEngineGateway | undefined;

export function getAnalysisEngineGateway() {
  if (gateway) return gateway;
  const config = getAnalysisEngineConfig();
  gateway = config.driver === "fixture"
    ? new FixtureAnalysisEngineGateway()
    : new HttpAnalysisEngineGateway(config.url, config.token, config.callbackToken, config.appBaseUrl);
  return gateway;
}
