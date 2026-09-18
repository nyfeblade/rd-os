"use strict";

/**
 * Sanitize untrusted vendor webhook text before it reaches a seat/LLM.
 * Structural fields stay; instruction-like strings and leaked tokens do not.
 */

const TEXT_KEYS = new Set(["body", "text", "title", "message", "quote"]);

const INJECTION = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/gi,
  /ignore\s+your\s+(instructions|programming)/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*prompt/gi,
  /\b(do\s+not\s+follow|disregard)\s+(your\s+)?(instructions|rules)/gi,
];

const SECRETS = [
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
];

const TOOL_CALL = /"tool_calls"\s*:|"name"\s*:\s*"[^"]+"\s*,\s*"arguments"/i;

function sanitizeText(text) {
  if (typeof text !== "string") return { text, dirty: false };
  let out = text;
  let dirty = false;
  for (const re of SECRETS) {
    const next = out.replace(re, "[redacted]");
    if (next !== out) dirty = true;
    out = next;
  }
  for (const re of INJECTION) {
    const next = out.replace(re, "[stripped]");
    if (next !== out) dirty = true;
    out = next;
  }
  if (TOOL_CALL.test(out)) {
    dirty = true;
    out = "[stripped tool-call JSON]";
  }
  if (dirty && out.length > 200) out = `${out.slice(0, 200)}…`;
  return { text: out, dirty };
}

function walk(value, key) {
  if (typeof value === "string") {
    if (key && (TEXT_KEYS.has(key) || key.endsWith("_body"))) return sanitizeText(value).text;
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => walk(entry));
  if (value && typeof value === "object") {
    const out = {};
    for (const [childKey, child] of Object.entries(value)) out[childKey] = walk(child, childKey);
    return out;
  }
  return value;
}

function payloadDirty(payload) {
  let dirty = false;
  function scan(value, key) {
    if (typeof value === "string") {
      if (key && (TEXT_KEYS.has(key) || key.endsWith("_body")) && sanitizeText(value).dirty) dirty = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) scan(entry);
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) scan(child, childKey);
    }
  }
  scan(payload);
  return dirty;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") return payload || {};
  return walk(payload);
}

module.exports = {
  TEXT_KEYS,
  sanitizeText,
  sanitizePayload,
  payloadDirty,
};
