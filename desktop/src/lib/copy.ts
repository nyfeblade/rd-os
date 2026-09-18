import type { WaitingOn } from "./attention";

export const RULES_PLAIN = [
  "Every experiment needs time in hours and minutes — not weeks — unless a person is gated.",
  "Plans need more than one probe unless you name a real constraint.",
  "Claims need evidence, not a score.",
  "Check how long similar work took before planning more.",
  "What is waiting on you stays at the top.",
] as const;

const GATE_PLAIN: Record<string, string> = {
  merge: "Merge",
  proof_accept: "Proof accept",
  quota_unfreeze: "Quota unfreeze",
  scope_change: "Scope change",
  physical_access: "Physical access",
  legal: "Legal",
  other: "Other",
};

export function assertNeverWaitingOn(who: never): never {
  throw new Error(`unhandled WaitingOn: ${who}`);
}

export function whyPlain(why: string, title?: string): string {
  const text = String(why || "");
  if (/board empty|no open experiment/i.test(text)) {
    return "Nothing waiting.";
  }
  if (/merge gate/i.test(text)) {
    return title ? `Plan ready — merge gate on ${title}` : "Plan ready — merge gate";
  }
  if (/Eng Proof owns verdict|packet present/i.test(text)) {
    return "Checking claims…";
  }
  if (/fan-out|claim instrument|open packet|fanout/i.test(text)) {
    return "Running probes…";
  }
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
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!minutes) {
    return `${hours}h`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function parseGate(entry: string): { experiment_id: string; kind: string } {
  const text = String(entry || "");
  const idx = text.lastIndexOf(":");
  if (idx < 0) {
    return { experiment_id: text, kind: "other" };
  }
  return { experiment_id: text.slice(0, idx), kind: text.slice(idx + 1) };
}

export function gatePlain(kind: string): string {
  return GATE_PLAIN[kind] || kind;
}

export function baselinePlain(hint: { baseline_ca_hours: number | null } | null | undefined): string {
  if (hint && typeof hint.baseline_ca_hours === "number") {
    return `Last similar run: ${hint.baseline_ca_hours} CA hours`;
  }
  return "No baseline yet";
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
