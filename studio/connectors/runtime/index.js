"use strict";

/**
 * studio/connectors/runtime — P0 GitHub + Slack two-way contracts.
 *
 *   ingest(envelope) → inbox item | dropped noise | { ok:false, code }
 *   reply(draft)     → outbound op (human or bot-with-gate) | { ok:false, code }
 *
 * Pure contracts. No HTTP. No invented REST/MCP paths. verdict stays null.
 */

const {
  PROVIDERS,
  TRAY_STATES,
  CODES,
  OUTBOUND_OPS,
  INBOX_FIELDS,
  OFFICIAL_DOCS,
  fail,
  pin,
  drop,
} = require("./contract");
const { authFailure } = require("./inbox");
const { humanGateAllows, cutoverAllows, gateDraft } = require("./reply");
const github = require("./providers/github");
const slack = require("./providers/slack");

const REGISTRY = {
  github,
  slack,
};

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return fail("INVALID_EVENT", "ingest envelope is not an object");
  }
  if (!PROVIDERS.includes(envelope.provider)) {
    return fail("UNKNOWN_PROVIDER", `provider=${JSON.stringify(envelope.provider)}`);
  }
  if (!TRAY_STATES.includes(envelope.tray_state)) {
    return fail("INVALID_EVENT", `tray_state=${JSON.stringify(envelope.tray_state)}`);
  }
  if (typeof envelope.event !== "string" || envelope.event.trim() === "") {
    return fail("UNKNOWN_EVENT", "envelope.event is empty");
  }
  return null;
}

function ingest(envelope) {
  const bad = validateEnvelope(envelope);
  if (bad) return pin(bad);
  if (envelope.tray_state === "needs_auth") return pin(authFailure(envelope.provider, envelope.tray_state));
  if (envelope.tray_state === "disconnected") return pin(drop("disconnected"));
  const provider = REGISTRY[envelope.provider];
  return pin(provider.ingest(envelope));
}

function validateDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return fail("INVALID_EVENT", "reply draft is not an object");
  }
  if (!PROVIDERS.includes(draft.provider)) {
    return fail("UNKNOWN_PROVIDER", `provider=${JSON.stringify(draft.provider)}`);
  }
  if (!TRAY_STATES.includes(draft.tray_state)) {
    return fail("INVALID_EVENT", `tray_state=${JSON.stringify(draft.tray_state)}`);
  }
  if (draft.tray_state !== "live") {
    return fail("NEEDS_AUTH", `reply requires tray_state=live, got ${draft.tray_state}`);
  }
  if (!draft.thread_ref || typeof draft.thread_ref !== "object") {
    return fail("INVALID_EVENT", "reply needs thread_ref");
  }
  if (typeof draft.bound_to !== "string" || draft.bound_to.trim() === "") {
    return fail("UNBOUND_REPLY", "reply composer must bind to the active notification/thread");
  }
  return gateDraft(draft);
}

function reply(draft) {
  const bad = validateDraft(draft);
  if (bad) return pin(bad);
  const provider = REGISTRY[draft.provider];
  return pin(provider.reply(draft));
}

module.exports = {
  ingest,
  reply,
  humanGateAllows,
  cutoverAllows,
  PROVIDERS,
  TRAY_STATES,
  CODES,
  OUTBOUND_OPS,
  INBOX_FIELDS,
  OFFICIAL_DOCS,
  REGISTRY,
};
