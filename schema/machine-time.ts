/**
 * HARD LAW 1 — machine-time fields on every experiment.
 * Ban human-week units unless a human gate is listed.
 * Types only; no runtime store in this PR.
 */

export type HumanGateKind =
  | "merge"
  | "proof_accept"
  | "quota_unfreeze"
  | "scope_change"
  | "physical_access"
  | "legal"
  | "other";

export interface HumanGate {
  kind: HumanGateKind;
  reason: string;
  /** Hours, never weeks. Only legal human duration field. */
  estimate_human_hours?: number;
}

export interface Actuals {
  ca_hours: number | null;
  proof_min: number | null;
  human_hours: number | null;
  finished_at: string | null;
}

export interface MachineTime {
  estimate_ca_hours: number;
  estimate_proof_min: number;
  human_gates: HumanGate[];
  actuals: Actuals;
}

/** Banned keys — must not appear on Experiment / MachineTime. */
export type BannedTimeKey =
  | "estimate_weeks"
  | "human_weeks"
  | "estimate_human_weeks"
  | "sprints";

export function assertNeverGate(kind: never): never {
  throw new Error(`unhandled HumanGateKind: ${kind}`);
}

export function describeGate(kind: HumanGateKind): string {
  switch (kind) {
    case "merge":
      return "human-owned merge";
    case "proof_accept":
      return "Eng Proof accept";
    case "quota_unfreeze":
      return "Luke/Elon unfreeze after ResourceExhausted";
    case "scope_change":
      return "human-approved shrink or grow";
    case "physical_access":
      return "physical or offline constraint";
    case "legal":
      return "legal / policy hold";
    case "other":
      return "named other human stop";
    default:
      return assertNeverGate(kind);
  }
}
