"use strict";

const REJECT_CODES = [
  "MISSING_KEY",
  "MISSING_PROMPT",
  "UNKNOWN_PROVIDER",
  "RESOURCE_EXHAUSTED",
  "PROVIDER_ERROR",
  "NETWORK_ERROR",
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
  return {
    ok: true,
    data: {
      text: data.text,
      model: data.model,
      provider: data.provider,
      usage: data.usage || null,
      wall_ms: data.wall_ms,
      stop: false,
    },
  };
}

function assertNeverReject(code) {
  throw new Error(`unhandled LlmRejectCode: ${code}`);
}

function assertNeverProvider(name) {
  throw new Error(`unhandled LlmProvider: ${name}`);
}

function describeReject(code) {
  switch (code) {
    case "MISSING_KEY":
      return "OPENAI_API_KEY is required";
    case "MISSING_PROMPT":
      return "prompt is required";
    case "UNKNOWN_PROVIDER":
      return "LLM_PROVIDER is not the shipped openai adapter";
    case "RESOURCE_EXHAUSTED":
      return "quota or rate limit — STOP, no retry";
    case "PROVIDER_ERROR":
      return "provider rejected the request";
    case "NETWORK_ERROR":
      return "network or fetch failed";
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
  if (
    code === "insufficient_quota" ||
    code === "rate_limit_exceeded" ||
    type === "insufficient_quota" ||
    statusText === "RESOURCE_EXHAUSTED" ||
    /resourceexhausted|insufficient[_ ]quota|rate[_ ]limit/i.test(message)
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
  assertNeverProvider,
  describeReject,
  isResourceExhausted,
};
