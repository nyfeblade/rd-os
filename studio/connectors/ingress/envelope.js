"use strict";

/**
 * Studio Ingest Schema — closed enough to implement against ARCHITECTURE.md.
 * Do not invent fields for the shell. Extra vendor detail stays inside payload.
 */

const ACTOR_KINDS = ["user", "bot", "app"];
const TRAY_STATES = ["live", "needs_auth", "error", "disconnected"];
const P0 = ["github", "slack"];
const LATER = ["linear", "sentry", "vercel", "cloudflare", "supabase"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildEnvelope(fields) {
  if (!isObject(fields)) {
    return { ok: false, code: "INVALID_EVENT", detail: "ingest envelope is not an object" };
  }
  if (typeof fields.provider !== "string" || fields.provider.trim() === "") {
    return { ok: false, code: "UNKNOWN_PROVIDER", detail: "envelope.provider is empty" };
  }
  if (LATER.includes(fields.provider)) {
    return { ok: false, code: "UNSUPPORTED_PROVIDER", detail: `wire order: ${fields.provider} is later` };
  }
  if (!P0.includes(fields.provider)) {
    return { ok: false, code: "UNKNOWN_PROVIDER", detail: `provider=${JSON.stringify(fields.provider)}` };
  }
  if (typeof fields.event !== "string" || fields.event.trim() === "") {
    return { ok: false, code: "UNKNOWN_EVENT", detail: "envelope.event is empty" };
  }
  if (!TRAY_STATES.includes(fields.tray_state)) {
    return { ok: false, code: "INVALID_EVENT", detail: `tray_state=${JSON.stringify(fields.tray_state)}` };
  }
  if (typeof fields.at_you !== "boolean") {
    return { ok: false, code: "INVALID_EVENT", detail: "at_you must be boolean" };
  }
  if (typeof fields.received_at !== "string" || fields.received_at.trim() === "") {
    return { ok: false, code: "INVALID_EVENT", detail: "received_at must be an ISO-8601 string" };
  }
  if (!isObject(fields.identity)) {
    return { ok: false, code: "INVALID_EVENT", detail: "identity must be an object" };
  }
  if (!ACTOR_KINDS.includes(fields.identity.actor_kind)) {
    return { ok: false, code: "INVALID_EVENT", detail: `identity.actor_kind=${JSON.stringify(fields.identity.actor_kind)}` };
  }
  if (typeof fields.identity.actor_id !== "string") {
    return { ok: false, code: "INVALID_EVENT", detail: "identity.actor_id must be a string" };
  }
  if (typeof fields.identity.as_user !== "boolean") {
    return { ok: false, code: "INVALID_EVENT", detail: "identity.as_user must be boolean" };
  }
  if (!isObject(fields.payload)) {
    return { ok: false, code: "INVALID_EVENT", detail: "payload must be a sanitized object" };
  }

  return {
    ok: true,
    envelope: {
      provider: fields.provider,
      event: fields.event,
      received_at: fields.received_at,
      at_you: fields.at_you,
      tray_state: fields.tray_state,
      identity: {
        actor_kind: fields.identity.actor_kind,
        actor_id: fields.identity.actor_id,
        as_user: fields.identity.as_user,
      },
      payload: fields.payload,
    },
  };
}

module.exports = {
  ACTOR_KINDS,
  TRAY_STATES,
  P0,
  LATER,
  buildEnvelope,
};
