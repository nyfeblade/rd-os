import type { WaitingOn } from "./attention";

export const RULES_PLAIN = [
  "Plan in CA hours and proof minutes — not weeks — unless a human gate is listed.",
  "Run at least two cheap probes before accepting a plan, unless a real constraint says one is enough.",
  "Don’t accept scores or vibes as proof — require fetch/run evidence.",
  "Remember finished CA-hour baselines for the next plan.",
  "Keep what’s waiting next to these rules — don’t bury them.",
] as const;

export const REJECT_REASONS = [
  "Score without evidence",
  "Scope shrunk without a reason",
  "Other",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export const DEFAULT_REJECT_REASON: RejectReason = "Score without evidence";

export function assertNeverWaitingOn(who: never): never {
  throw new Error(`unhandled WaitingOn: ${who}`);
}

export function assertNeverRejectReason(reason: never): never {
  throw new Error(`unhandled RejectReason: ${reason}`);
}

export function whyPlain(why: string): string {
  const text = String(why || "").trim();
  return text || "Something is waiting.";
}

export function waitingOnWho(who: WaitingOn): string {
  switch (who) {
    case "human":
      return "Human";
    case "proof":
      return "Proof";
    case "agent":
      return "Agent";
    default:
      return assertNeverWaitingOn(who);
  }
}

export function humanRowDetail(): string {
  return "Agents finished probes. Decision required.";
}

export function formatAge(ageS: number): string {
  const seconds = Number(ageS) || 0;
  if (seconds < 60) {
    return "0m";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (!minutes) {
      return `${hours}h`;
    }
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${Math.floor(seconds / 86400)}d`;
}

export function parseGate(entry: string): { experiment_id: string; kind: string } {
  const text = String(entry || "");
  const idx = text.lastIndexOf(":");
  if (idx < 0) {
    return { experiment_id: text, kind: "other" };
  }
  return { experiment_id: text.slice(0, idx), kind: text.slice(idx + 1) };
}

export function experimentPlain(id: string): string {
  const match = String(id).match(/^exp-(\d+)/i);
  if (match && match[1]) {
    return `Exp-${match[1]}`;
  }
  return id;
}

export function gateFootEntry(entry: string): string {
  const parsed = parseGate(entry);
  return `${parsed.kind} · ${experimentPlain(parsed.experiment_id)}`;
}

export function baselinePlain(hint: { baseline_ca_hours: number | null } | null | undefined): string {
  if (hint && typeof hint.baseline_ca_hours === "number") {
    return `Last similar run: ${hint.baseline_ca_hours} CA hours`;
  }
  return "No similar run yet";
}

export function formatDumpAge(ageMs: number | null): string {
  if (ageMs == null) {
    return "live";
  }
  if (ageMs < 5000) {
    return "live";
  }
  return formatAge(Math.floor(ageMs / 1000));
}
