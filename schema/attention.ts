/**
 * HARD LAW 5 — live attention pane is P0; HARD LAW sits beside it.
 * Cockpit v0 = this dump. No product UI.
 */

export type WaitingOn = "human" | "agent" | "proof";

export interface AttentionP0 {
  id: string;
  why: string;
  waiting_on: WaitingOn;
  age_s: number;
}

export type HardLawId =
  | "machine-time"
  | "multi-lane"
  | "research-before-claim"
  | "envelope"
  | "attention-beside-law";

export interface EnvelopeHint {
  nearest_experiment_id: string | null;
  baseline_ca_hours: number | null;
}

export interface AttentionDump {
  p0: AttentionP0 | null;
  hard_law: HardLawId[];
  open_gates: string[];
  envelope_hint: EnvelopeHint;
}

export function assertNeverWaitingOn(who: never): never {
  throw new Error(`unhandled WaitingOn: ${who}`);
}

export function assertNeverHardLawId(id: never): never {
  throw new Error(`unhandled HardLawId: ${id}`);
}
