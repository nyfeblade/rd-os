"use strict";

const { ok, reject, assertNever } = require("./result");
const { HANDOFF_TARGETS, HANDOFF_SCHEMA } = require("./codes");
const { handoffId } = require("./ids");
const { appendEvent } = require("./store");

function defaultAdapter(target) {
  return async function stubAdapter(_payload) {
    return {
      mode: "stub",
      status: "queued",
      reason: `${target}_live_needs_secret`,
    };
  };
}

function resolveAdapters(input) {
  const given = input || {};
  return {
    cursor_ca: given.cursor_ca || defaultAdapter("cursor_ca"),
    claude_code: given.claude_code || defaultAdapter("claude_code"),
  };
}

async function playHandoff(home, thread, snapshot, focus, pack, input, deps) {
  const target = input && input.target;
  if (HANDOFF_TARGETS.indexOf(target) < 0) {
    return reject("UNKNOWN_HANDOFF_TARGET", "target must be cursor_ca or claude_code");
  }
  const brief = input && typeof input.brief === "string" ? input.brief : "";
  const payload = {
    schema: HANDOFF_SCHEMA,
    target,
    brief,
    bind: thread.bind,
    snapshot,
    focus,
    pack,
  };
  const receipt = {
    id: handoffId(),
    target,
    created_at: deps.nowIso(),
    thread_id: thread.id,
  };
  if (input && input.dry_run === true) {
    const result = {
      mode: "dry_run",
      target,
      status: "dry_run",
      payload,
      receipt: Object.assign({}, receipt, { status: "dry_run" }),
    };
    appendEvent(home, thread.id, {
      id: receipt.id,
      kind: "handoff",
      source: target === "cursor_ca" ? "ca" : "claude_code",
      status: "dry_run",
      summary: brief || `dry-run ${target}`,
      created_at: receipt.created_at,
      payload_attached: true,
    });
    return ok(result);
  }
  const adapters = resolveAdapters(deps.adapters);
  let dispatched;
  switch (target) {
    case "cursor_ca":
      dispatched = await adapters.cursor_ca(payload);
      break;
    case "claude_code":
      dispatched = await adapters.claude_code(payload);
      break;
    default:
      return assertNever(target, "HandoffTarget");
  }
  const mode = dispatched && dispatched.mode === "dry_run" ? "dry_run" : "stub";
  const status = (dispatched && dispatched.status) || "queued";
  const result = {
    mode,
    target,
    status,
    reason: (dispatched && dispatched.reason) || `${target}_adapter_unconfigured`,
    payload,
    receipt: Object.assign({}, receipt, { status, mode }),
  };
  appendEvent(home, thread.id, {
    id: receipt.id,
    kind: "handoff",
    source: target === "cursor_ca" ? "ca" : "claude_code",
    status,
    summary: brief || `${mode} ${target}`,
    created_at: receipt.created_at,
    payload_attached: true,
    reason: result.reason,
  });
  return ok(result);
}

module.exports = {
  playHandoff,
  resolveAdapters,
};
