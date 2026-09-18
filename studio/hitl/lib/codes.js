"use strict";

const REJECT_CODES = {
  MISSING_FIELD: "MISSING_FIELD",
  UNKNOWN_KIND: "UNKNOWN_KIND",
  UNKNOWN_GATE: "UNKNOWN_GATE",
  UNKNOWN_DECISION: "UNKNOWN_DECISION",
  HUMAN_REQUIRED: "HUMAN_REQUIRED",
  AUTO_APPROVE_FORBIDDEN: "AUTO_APPROVE_FORBIDDEN",
  ALREADY_RESOLVED: "ALREADY_RESOLVED",
  INVALID_GATE: "INVALID_GATE",
  UNKNOWN_STATUS: "UNKNOWN_STATUS",
};

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

module.exports = {
  REJECT_CODES,
  reject,
  ok,
  assertNever,
};
