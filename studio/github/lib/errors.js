"use strict";

const REJECT_CODES = [
  "RESOURCE_EXHAUSTED",
  "GITHUB_HTTP",
  "NETWORK_ERROR",
  "UNKNOWN_CONNECTOR",
  "STUB_CONNECTOR",
  "MISSING_REPO",
  "UNKNOWN_PATH",
  "UNKNOWN_SOURCE",
  "NO_KERNEL",
];

function reject(code, detail, extra) {
  const wallMs = extra && Number.isFinite(extra.wall_ms) ? extra.wall_ms : 0;
  return {
    ok: false,
    code,
    detail,
    wall_ms: wallMs,
    stop: code === "RESOURCE_EXHAUSTED",
  };
}

function ok(data) {
  return { ok: true, data, stop: false };
}

function assertNeverReject(code) {
  throw new Error(`unhandled StudioRejectCode: ${code}`);
}

function assertNeverConnector(id) {
  throw new Error(`unhandled ConnectorId: ${id}`);
}

function assertNeverSource(source) {
  throw new Error(`unhandled StudioSource: ${source}`);
}

function describeReject(code) {
  switch (code) {
    case "RESOURCE_EXHAUSTED":
      return "quota or rate limit — STOP, no retry";
    case "GITHUB_HTTP":
      return "GitHub rejected the request";
    case "NETWORK_ERROR":
      return "network or fetch failed";
    case "UNKNOWN_CONNECTOR":
      return "connector id is not in the max-connector scaffold";
    case "STUB_CONNECTOR":
      return "seat stub — later wire via studio/seats";
    case "MISSING_REPO":
      return "owner/name is required to attach GitHub";
    case "UNKNOWN_PATH":
      return "path is not on the browse tree";
    case "UNKNOWN_SOURCE":
      return "STUDIO_SOURCE must be fixture or github";
    case "NO_KERNEL":
      return "public rdos CLI not found; studio does not own the kernel";
    default:
      return assertNeverReject(code);
  }
}

function isResourceExhausted(status, body) {
  if (status === 429) {
    return true;
  }
  const err = body && typeof body === "object" ? body.error || body : null;
  const code = err && typeof err.code === "string" ? err.code.toLowerCase() : "";
  const type = err && typeof err.type === "string" ? err.type.toLowerCase() : "";
  const statusText = err && typeof err.status === "string" ? err.status : "";
  const message = err && typeof err.message === "string" ? err.message : "";
  const raw = typeof body === "string" ? body : "";
  if (
    code === "insufficient_quota" ||
    code === "rate_limit_exceeded" ||
    type === "insufficient_quota" ||
    statusText === "RESOURCE_EXHAUSTED" ||
    /resourceexhausted|insufficient[_ ]quota|rate[_ ]limit/i.test(message) ||
    /resourceexhausted|rate[_ ]limit/i.test(raw)
  ) {
    return true;
  }
  return false;
}

module.exports = {
  REJECT_CODES,
  reject,
  ok,
  assertNeverReject,
  assertNeverConnector,
  assertNeverSource,
  describeReject,
  isResourceExhausted,
};
