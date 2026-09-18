"use strict";

const { reject } = require("./reject");

const GATE_KINDS = new Set([
  "merge",
  "proof_accept",
  "quota_unfreeze",
  "scope_change",
  "physical_access",
  "legal",
  "other",
]);

const SEAT_ROLES = new Set(["author", "proof", "human"]);

const BANNED_TIME_KEYS = new Set([
  "estimate_weeks",
  "human_weeks",
  "estimate_human_weeks",
  "sprints",
]);

const WEEK_TOKEN = /\b(weeks?|sprints?|human_week)\b/i;
const WEIGHT_ONLY_TOKEN = /\b(lgtm|looks good|confidence|probability|stars|i am \d+% sure|high)\b|Δ|\bdelta\b/i;

function requireString(payload, key, code = "MISSING_FIELD") {
  if (!payload || typeof payload[key] !== "string" || !payload[key].trim()) {
    return reject(code, `${key} is required`);
  }
  return null;
}

function rejectClockStarted(payload) {
  if (payload && payload.clock_started === true) {
    return reject("CLOCK_STARTED_FORBIDDEN", "MCP tools must not arm kill14d; clock_started stays false");
  }
  return null;
}

function rejectWeekWithoutGate(payload) {
  const gates = Array.isArray(payload.human_gates) ? payload.human_gates : [];
  const hits = [];
  walk(payload, (key, value, trail) => {
    if (BANNED_TIME_KEYS.has(key)) {
      hits.push(trail ? `${trail}.${key}` : key);
      return;
    }
    if (trail.includes("human_gates") && key === "estimate_human_hours") {
      return;
    }
    if (typeof value === "string" && WEEK_TOKEN.test(value)) {
      hits.push(trail ? `${trail}.${key}` : key);
    }
  });
  if (hits.length && gates.length === 0) {
    return reject("HUMAN_WEEK_WITHOUT_GATE", `week/sprint unit without a human gate: ${hits.join(", ")}`);
  }
  if (hits.some((hit) => BANNED_TIME_KEYS.has(hit.split(".").pop()))) {
    return reject("HUMAN_WEEK_WITHOUT_GATE", `banned week key stored: ${hits.join(", ")}`);
  }
  return null;
}

function walk(value, visit, trail = "") {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, trail);
    if (child && typeof child === "object") {
      walk(child, visit, trail ? `${trail}.${key}` : key);
    }
  }
}

function claimLooksWeightOnly(payload) {
  const parts = [payload.body, payload.claim, payload.text, payload.verdict_text, payload.summary]
    .filter((part) => typeof part === "string")
    .join(" ");
  if (payload.confidence != null || payload.delta != null || payload.stars != null || payload.weight != null) {
    return true;
  }
  return Boolean(parts) && WEIGHT_ONLY_TOKEN.test(parts);
}

function resolvePacket(payload) {
  if (payload.packet && typeof payload.packet === "object") {
    return payload.packet;
  }
  if (payload.runner_result && payload.measured_exit != null) {
    return payload;
  }
  if (payload.runner_result && (payload.packet_id || payload.id || payload.uri || payload.packet_uri || payload.evidence_uri)) {
    return payload;
  }
  return null;
}

function packetLooksMarkdown(packet, payload) {
  const uri = String(payload.packet_uri || payload.evidence_uri || payload.uri || (packet && packet.packet_uri) || "");
  if (/\.(md|markdown)$/i.test(uri) || /skill\.md/i.test(uri)) {
    return true;
  }
  if (packet && (packet.kind === "markdown" || packet.type === "skill" || payload.kind === "markdown")) {
    return true;
  }
  return false;
}

function hasRunnerResult(packet) {
  const result = packet.runner_result || (packet.result && packet.result.observed && packet.result.observed.runner_result);
  return result === "VERIFIED" || result === "REJECTED" || result === "INCONCLUSIVE";
}

function rejectPacket(payload) {
  if (payload.verdict != null) {
    return reject("SELF_CERT", "packet verdict is proof.verdict only");
  }
  const week = rejectWeekWithoutGate(payload);
  if (week) {
    return week;
  }
  const weightBody = claimLooksWeightOnly(payload);
  const packet = resolvePacket(payload);
  if (weightBody && !packet) {
    return reject("WEIGHT_ONLY", "claim is only confidence/Δ/LGTM with no instrument packet");
  }
  if (!packet) {
    return reject("NO_RESEARCH", "packet.upsert needs a Proof Layer packet or fetch/run evidence_uri");
  }
  if (packetLooksMarkdown(packet, payload)) {
    return reject("NO_RESEARCH", "markdown/skill/chat is not an instrument packet");
  }
  if (weightBody && !hasRunnerResult(packet)) {
    return reject("WEIGHT_ONLY", "weight may sit beside evidence, not replace it");
  }
  if (!hasRunnerResult(packet)) {
    return reject("NO_RESEARCH", "packet missing runner_result VERIFIED|REJECTED|INCONCLUSIVE");
  }
  if (packet.verdict != null) {
    return reject("SELF_CERT", "packet.verdict must stay null until proof.verdict");
  }
  return null;
}

function rejectUnknownGateKind(kind) {
  if (!kind || !GATE_KINDS.has(kind)) {
    return reject("GATE_UNKNOWN_KIND", `human gate kind must be one of ${[...GATE_KINDS].join("|")}`);
  }
  return null;
}

function rejectUnknownSeatRole(role) {
  if (!SEAT_ROLES.has(role)) {
    return reject("SEAT_FORBIDDEN", "board.assign_seat requires role author|proof|human");
  }
  return null;
}

function actorOf(payload, ctx) {
  if (payload && typeof payload.actor === "string" && payload.actor.trim()) {
    return payload.actor.trim();
  }
  if (ctx && typeof ctx.actor === "string" && ctx.actor.trim()) {
    return ctx.actor.trim();
  }
  return "agent";
}

module.exports = {
  GATE_KINDS,
  SEAT_ROLES,
  requireString,
  rejectClockStarted,
  rejectWeekWithoutGate,
  rejectPacket,
  rejectUnknownGateKind,
  rejectUnknownSeatRole,
  actorOf,
  claimLooksWeightOnly,
};
