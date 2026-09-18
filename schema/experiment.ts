import type { MachineTime } from "./machine-time";

export type ProbeKind = "fetch" | "run";

export type ProbeStatus = "pending" | "fetched" | "ran" | "failed";

export interface Probe {
  id: string;
  kind: ProbeKind;
  command_or_url: string;
  evidence_uri: string | null;
  status: ProbeStatus;
}

export type AntiSingleLane = "pass" | "fail";

export interface FanOut {
  n: number;
  probes: Probe[];
  /** Evidence-only. Prose summaries are not a legal recombine mode. */
  recombine: "evidence_only";
  anti_single_lane: AntiSingleLane;
  /** Physics or human constraint that can legalize n<2. */
  constraint: string | null;
}

export type ExperimentStage =
  | "open"
  | "fanout"
  | "accepted"
  | "finished"
  | "killed";

export interface Experiment extends MachineTime {
  experiment_id: string;
  title: string;
  stage: ExperimentStage;
  fanout: FanOut | null;
  envelope_query_id: string | null;
}

export function assertNeverStage(stage: never): never {
  throw new Error(`unhandled ExperimentStage: ${stage}`);
}

export function assertNeverProbeKind(kind: never): never {
  throw new Error(`unhandled ProbeKind: ${kind}`);
}
