"use strict";

const { reject } = require("./reject");

function stableSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const keys = Object.keys(value).filter((key) => key !== "idempotency_key").sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
}

function payloadHash(payload) {
  return stableSerialize(payload && typeof payload === "object" ? payload : {});
}

function createIdempotencyStore() {
  const rows = new Map();

  function lookup(tool, payload) {
    const key = payload && typeof payload.idempotency_key === "string" ? payload.idempotency_key.trim() : "";
    if (!key) {
      return { mode: "missing" };
    }
    const hash = payloadHash(payload);
    const stored = rows.get(`${tool}::${key}`);
    if (!stored) {
      return { mode: "fresh", key, hash };
    }
    if (stored.hash !== hash) {
      return {
        mode: "conflict",
        result: reject(
          "IDEMPOTENCY_CONFLICT",
          `idempotency_key ${key} already bound to a different ${tool} payload`
        ),
      };
    }
    return { mode: "replay", result: cloneResult(stored.result) };
  }

  function remember(tool, payload, result) {
    const key = payload && typeof payload.idempotency_key === "string" ? payload.idempotency_key.trim() : "";
    if (!key) {
      return;
    }
    rows.set(`${tool}::${key}`, {
      hash: payloadHash(payload),
      result: cloneResult(result),
    });
  }

  return { lookup, remember };
}

function cloneResult(result) {
  return JSON.parse(JSON.stringify(result));
}

module.exports = {
  createIdempotencyStore,
  payloadHash,
  stableSerialize,
};
