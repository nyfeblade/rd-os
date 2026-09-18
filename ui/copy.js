"use strict";

const REJECT_PLAIN = {
  MISSING_MACHINE_TIME: "Rejected: missing time fields",
  HUMAN_WEEK_WITHOUT_GATE: "Rejected: week estimate without a human gate",
  MISSING_ACTUALS: "Rejected: missing actual time spent",
  SINGLE_LANE: "Rejected: only one probe",
  PROBE_NOT_FETCH_OR_RUN: "Rejected: a probe did not fetch or run",
  NO_EVIDENCE_RECOMBINE: "Rejected: no evidence to combine",
  NO_ENVELOPE_QUERY: "Rejected: no past-run check",
  NOT_FINISHED: "Rejected: experiment is not finished",
  NO_RESEARCH: "Rejected: no evidence packet",
  WEIGHT_ONLY: "Rejected: score without evidence",
  UNDER_SCOPE: "Rejected: plan shrank without a real constraint",
  SELF_CERT: "Rejected: you can’t certify your own result",
  NOT_HUMAN: "Only you can do this",
  UNKNOWN_TOOL: "Rejected: unknown action",
};

const GATE_PLAIN = {
  merge: "Merge",
  proof_accept: "Proof accept",
  quota_unfreeze: "Quota unfreeze",
  scope_change: "Scope change",
  physical_access: "Physical access",
  legal: "Legal",
  other: "Other",
};

const RULES_PLAIN = [
  "Every experiment needs time in hours and minutes — not weeks — unless a person is gated.",
  "Plans need more than one probe unless you name a real constraint.",
  "Claims need evidence, not a score.",
  "Check how long similar work took before planning more.",
  "What is waiting on you stays at the top.",
];

function assertNeverWaitingOn(who) {
  throw new Error(`unhandled WaitingOn: ${who}`);
}

function whyPlain(why) {
  const text = String(why || "");
  if (/board empty|no open experiment/i.test(text)) {
    return "Nothing waiting.";
  }
  if (/merge gate/i.test(text)) {
    return "Plan ready — merge gate";
  }
  if (/Eng Proof owns verdict|packet present/i.test(text)) {
    return "Checking claims…";
  }
  if (/fan-out|claim instrument|open packet|fanout/i.test(text)) {
    return "Running probes…";
  }
  return text || "Something is waiting.";
}

function waitingOnWho(who) {
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

function waitingRowLabel(who) {
  return waitingOnWho(who);
}

function humanRowDetail() {
  return "Agents finished probes. Decision required.";
}

function rejectPlain(code) {
  return REJECT_PLAIN[code] || (code ? `Rejected: ${code}` : "Rejected");
}

function gatePlain(kind) {
  return GATE_PLAIN[kind] || kind;
}

function formatAge(ageS) {
  const s = Number(ageS) || 0;
  if (s < 60) {
    return `${s}s`;
  }
  if (s < 3600) {
    return `${Math.floor(s / 60)}m`;
  }
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (!minutes) {
    return `${hours}h`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function parseGate(entry) {
  const text = String(entry || "");
  const idx = text.lastIndexOf(":");
  if (idx < 0) {
    return { experiment_id: text, kind: "other" };
  }
  return { experiment_id: text.slice(0, idx), kind: text.slice(idx + 1) };
}

if (typeof window !== "undefined") {
  window.RdosCopy = {
    REJECT_PLAIN,
    GATE_PLAIN,
    RULES_PLAIN,
    whyPlain,
    waitingOnWho,
    waitingRowLabel,
    humanRowDetail,
    rejectPlain,
    gatePlain,
    formatAge,
    parseGate,
  };
}
