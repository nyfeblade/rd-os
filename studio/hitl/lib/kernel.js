"use strict";

const { ok, reject } = require("./codes");
const {
  GATE_KINDS,
  HUMAN_ACTOR,
  isGateKind,
  isHighRiskKind,
  isDecision,
  isForbiddenDecisionActor,
  needYouOf,
  riskOf,
  statusFromDecision,
} = require("./kinds");
const { emptyBinds, parseBindNotes } = require("./binds");

function nowIso(clock) {
  return (clock && typeof clock.now === "function" ? new Date(clock.now()) : new Date()).toISOString();
}

function nextId(ids, prefix) {
  return ids && typeof ids.next === "function" ? ids.next() : `${prefix}${Math.random().toString(16).slice(2, 10)}`;
}

function snapshot(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    need_you: needYouOf(row.status),
    risk: row.risk,
    payload_summary: row.payload_summary,
    status: row.status,
    created_at: row.created_at,
    binds: {
      chat_thread_id: row.binds.chat_thread_id,
      board_card_id: row.binds.board_card_id,
    },
  };
}

function createHitlKernel(opts) {
  const clock = opts && opts.clock;
  const ids = opts && opts.ids;
  const rows = new Map();

  function createGate(input) {
    const fields = input && typeof input === "object" ? input : {};
    if (fields.auto_approve === true || fields.status === "approved") {
      return reject("AUTO_APPROVE_FORBIDDEN", "createGate cannot approve; a human must resolveGate");
    }
    if (fields.need_you === false) {
      return reject("AUTO_APPROVE_FORBIDDEN", "createGate cannot hide a gate from need-you");
    }
    if (fields.risk != null && fields.risk !== riskOf(fields.kind)) {
      return reject("INVALID_GATE", "risk is derived from kind; do not set it");
    }
    const kind = typeof fields.kind === "string" ? fields.kind : "";
    if (!kind) {
      return reject("MISSING_FIELD", "createGate requires kind");
    }
    if (!isGateKind(kind)) {
      return reject("UNKNOWN_KIND", `kind must be one of ${GATE_KINDS.join("|")}`);
    }
    const title = typeof fields.title === "string" ? fields.title.trim() : "";
    if (!title) {
      return reject("MISSING_FIELD", "createGate requires title");
    }
    const payload = typeof fields.payload_summary === "string" ? fields.payload_summary : "";
    const binds = parseBindNotes(fields.binds || fields);
    if (!binds.ok) {
      return binds;
    }
    const row = {
      id: nextId(ids, "gate_"),
      kind,
      title,
      risk: riskOf(kind),
      payload_summary: payload,
      status: "open",
      created_at: nowIso(clock),
      binds: binds.data || emptyBinds(),
    };
    rows.set(row.id, row);
    return ok({ gate: snapshot(row) });
  }

  function listNeedYou() {
    const gates = Array.from(rows.values())
      .filter((row) => needYouOf(row.status))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .map(snapshot);
    return ok({ gates });
  }

  function getGate(id) {
    const row = rows.get(id);
    if (!row) {
      return reject("UNKNOWN_GATE", `no gate ${id}`);
    }
    return ok({ gate: snapshot(row) });
  }

  function resolveGate(input) {
    const fields = input && typeof input === "object" ? input : {};
    const id = typeof fields.id === "string" ? fields.id : "";
    if (!id) {
      return reject("MISSING_FIELD", "resolveGate requires id");
    }
    const decision = fields.decision;
    if (!isDecision(decision)) {
      return reject("UNKNOWN_DECISION", "resolveGate decision must be approve|reject|defer");
    }
    const row = rows.get(id);
    if (!row) {
      return reject("UNKNOWN_GATE", `no gate ${id}`);
    }
    const actor = fields.actor;
    if (isHighRiskKind(row.kind)) {
      if (actor !== HUMAN_ACTOR || isForbiddenDecisionActor(actor)) {
        return reject("HUMAN_REQUIRED", "high-risk kinds require an explicit human decision");
      }
      if (fields.via && fields.via !== "human") {
        return reject("AUTO_APPROVE_FORBIDDEN", "merge/deploy/public/db cannot resolve a gate");
      }
    }
    const nextStatus = statusFromDecision(decision);
    if (row.status !== "open") {
      if (row.status === nextStatus) {
        return ok({ gate: snapshot(row) });
      }
      return reject("ALREADY_RESOLVED", `gate ${id} is ${row.status}`);
    }
    row.status = nextStatus;
    return ok({ gate: snapshot(row) });
  }

  return {
    createGate,
    listNeedYou,
    resolveGate,
    getGate,
  };
}

module.exports = {
  createHitlKernel,
};
