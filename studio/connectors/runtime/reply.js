"use strict";

const { ACTORS, GATE_STATUSES, OUTBOUND_OPS, REPLY_KINDS, fail, isBlank } = require("./contract");

/**
 * Human-gate hook for bot_send.
 * Human replies pass. Bot replies pass only when human_gate.status === "approved".
 */
function humanGateAllows(draft) {
  if (!draft || draft.actor !== "bot") return true;
  return Boolean(draft.human_gate && draft.human_gate.status === "approved");
}

function outbound(fields) {
  if (!OUTBOUND_OPS.includes(fields.op)) {
    return fail("INVALID_EVENT", `op=${JSON.stringify(fields.op)} not in closed outbound ops`);
  }
  if (!REPLY_KINDS.includes(fields.kind)) {
    return fail("INVALID_EVENT", `kind=${JSON.stringify(fields.kind)} not in closed reply kinds`);
  }
  if (!ACTORS.includes(fields.actor)) {
    return fail("INVALID_EVENT", `actor=${JSON.stringify(fields.actor)}`);
  }
  if (!fields.request || typeof fields.request !== "object") {
    return fail("INVALID_EVENT", "outbound request must be an object");
  }
  if (isBlank(fields.request.body) && isBlank(fields.request.text)) {
    return fail("EMPTY_BODY", "outbound request has no body/text");
  }

  const gate =
    fields.actor === "bot"
      ? { status: "approved", by: (fields.human_gate && fields.human_gate.by) || null }
      : null;

  return {
    ok: true,
    dropped: false,
    item: null,
    outbound: {
      op: fields.op,
      provider: fields.provider,
      actor: fields.actor,
      kind: fields.kind,
      request: fields.request,
      human_gate: gate,
    },
  };
}

function gateDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return fail("INVALID_EVENT", "reply draft is not an object");
  }
  if (!ACTORS.includes(draft.actor)) {
    return fail("INVALID_EVENT", `actor=${JSON.stringify(draft.actor)}`);
  }
  if (isBlank(draft.body)) {
    return fail("EMPTY_BODY", "reply body is empty");
  }
  if (draft.human_gate != null) {
    if (typeof draft.human_gate !== "object" || Array.isArray(draft.human_gate)) {
      return fail("INVALID_EVENT", "human_gate must be an object");
    }
    if (draft.human_gate.status && !GATE_STATUSES.includes(draft.human_gate.status)) {
      return fail("INVALID_EVENT", `human_gate.status=${JSON.stringify(draft.human_gate.status)}`);
    }
  }
  if (!humanGateAllows(draft)) {
    return fail("BOT_SEND_NO_GATE", "bot_send requires human_gate.status===approved");
  }
  return null;
}

module.exports = {
  humanGateAllows,
  outbound,
  gateDraft,
};
