"use strict";

const { INBOX_KINDS, DEST, TRAY_STATES, PROVIDERS, INBOX_FIELDS, fail } = require("./contract");

/**
 * Studio inbox item — the Chat/Board consumer shape.
 * Shell and seats consume this object; they do not invent fields.
 */
function item(fields) {
  if (!fields || typeof fields !== "object") {
    return { ok: false, error: fail("INVALID_EVENT", "inbox item is not an object") };
  }

  if (!PROVIDERS.includes(fields.provider)) {
    return { ok: false, error: fail("UNKNOWN_PROVIDER", `provider=${JSON.stringify(fields.provider)}`) };
  }
  if (!INBOX_KINDS.includes(fields.kind)) {
    return { ok: false, error: fail("INVALID_EVENT", `kind=${JSON.stringify(fields.kind)} not in closed inbox kinds`) };
  }
  if (!DEST.includes(fields.dest)) {
    return { ok: false, error: fail("INVALID_EVENT", `dest=${JSON.stringify(fields.dest)}`) };
  }
  if (!TRAY_STATES.includes(fields.tray_state)) {
    return { ok: false, error: fail("INVALID_EVENT", `tray_state=${JSON.stringify(fields.tray_state)}`) };
  }
  if (typeof fields.need_you !== "boolean") {
    return { ok: false, error: fail("INVALID_EVENT", "need_you must be boolean") };
  }
  const needsGate = fields.dest === "board" || fields.dest === "chat+board";
  if (fields.needs_gate !== undefined && fields.needs_gate !== needsGate) {
    return {
      ok: false,
      error: fail("INVALID_EVENT", "needs_gate must match dest (Board card only when a gate is required)"),
    };
  }
  if (typeof fields.id !== "string" || fields.id.trim() === "") {
    return { ok: false, error: fail("INVALID_EVENT", "inbox id is empty") };
  }
  if (typeof fields.title !== "string") {
    return { ok: false, error: fail("INVALID_EVENT", "title must be a string") };
  }
  if (typeof fields.body !== "string") {
    return { ok: false, error: fail("INVALID_EVENT", "body must be a string") };
  }
  if (typeof fields.created_at !== "string") {
    return { ok: false, error: fail("INVALID_EVENT", "created_at must be a string") };
  }
  if (!fields.thread_ref || typeof fields.thread_ref !== "object" || Array.isArray(fields.thread_ref)) {
    return { ok: false, error: fail("INVALID_EVENT", "thread_ref must be an object") };
  }
  if (!fields.actor || typeof fields.actor !== "object" || Array.isArray(fields.actor)) {
    return { ok: false, error: fail("INVALID_EVENT", "actor must be an object") };
  }

  const built = {};
  for (const key of INBOX_FIELDS) built[key] = fields[key];
  built.needs_gate = needsGate;
  return { ok: true, item: built };
}

function reportItem(fields) {
  const built = item(fields);
  if (!built.ok) return built.error;
  return { ok: true, dropped: false, item: built.item, outbound: null };
}

function authFailure(provider, trayState) {
  return reportItem({
    id: `${provider}:auth`,
    provider,
    kind: "auth_failure",
    need_you: true,
    dest: "chat+board",
    thread_ref: {},
    title: `${provider} needs auth`,
    body: "connector auth failure",
    actor: { login: "studio" },
    created_at: "",
    tray_state: trayState,
  });
}

module.exports = {
  item,
  reportItem,
  authFailure,
};
