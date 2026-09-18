"use strict";

function ok(data) {
  return { ok: true, data };
}

function reject(code, detail, extra) {
  const result = { ok: false, code, detail: detail || "" };
  if (extra && typeof extra === "object") {
    Object.assign(result, extra);
  }
  return result;
}

function assertNever(value, label) {
  throw new Error(`unhandled ${label || "value"}: ${String(value)}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  ok,
  reject,
  assertNever,
  isObject,
  isNonEmptyString,
};
