"use strict";

/**
 * Closed reject set for the CA2 control-plane MCP contract.
 * v0 HARD LAW codes stay; lock/seat/budget/idempotency codes are additive.
 */

const REJECT_CODES = [
  "MISSING_MACHINE_TIME",
  "HUMAN_WEEK_WITHOUT_GATE",
  "MISSING_ACTUALS",
  "SINGLE_LANE",
  "PROBE_NOT_FETCH_OR_RUN",
  "NO_EVIDENCE_RECOMBINE",
  "NO_ENVELOPE_QUERY",
  "NOT_FINISHED",
  "NO_RESEARCH",
  "WEIGHT_ONLY",
  "UNDER_SCOPE",
  "SELF_CERT",
  "NOT_HUMAN",
  "UNKNOWN_TOOL",
  "MISSING_FIELD",
  "MISSING_IDEMPOTENCY_KEY",
  "IDEMPOTENCY_CONFLICT",
  "LOCK_HELD",
  "LOCK_REQUIRED",
  "SEAT_FORBIDDEN",
  "GATE_UNKNOWN_KIND",
  "RESOURCE_EXHAUSTED",
  "CLOCK_STARTED_FORBIDDEN",
  "NOT_FOUND",
];

function reject(code, detail) {
  if (!REJECT_CODES.includes(code)) {
    return assertNeverReject(code);
  }
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNeverReject(code) {
  throw new Error(`unhandled RejectCode: ${code}`);
}

function assertNeverTool(tool) {
  throw new Error(`unhandled McpTool: ${tool}`);
}

module.exports = {
  REJECT_CODES,
  reject,
  ok,
  assertNeverReject,
  assertNeverTool,
};
