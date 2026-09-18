"use strict";

/**
 * Human-gate store owned by CA2 until CA1 adds a gates table.
 * TODO(CA1): replace with plane.gates when that API lands. Do not write SQLite here.
 */

const { reject, ok } = require("./reject");
const { GATE_KINDS } = require("./validate");

function createGateStore() {
  const rows = [];

  function list(experimentId) {
    const gates = experimentId
      ? rows.filter((row) => row.experiment_id === experimentId)
      : rows.slice();
    return ok({ gates: gates.map((row) => ({ ...row })) });
  }

  function add(payload) {
    const experimentId = (payload.experiment_id || "").toString().trim();
    const kind = payload.kind;
    if (!experimentId) {
      return reject("MISSING_FIELD", "gate.add requires experiment_id");
    }
    if (!GATE_KINDS.has(kind)) {
      return reject("GATE_UNKNOWN_KIND", `human gate kind must be one of ${[...GATE_KINDS].join("|")}`);
    }
    const gate = {
      experiment_id: experimentId,
      kind,
      reason: payload.reason || "",
      estimate_human_hours: payload.estimate_human_hours,
      resolved: false,
      added_at: new Date().toISOString(),
    };
    rows.push(gate);
    return ok({ gate: { ...gate }, gates: rows.filter((row) => row.experiment_id === experimentId).map((row) => ({ ...row })) });
  }

  function resolve(payload) {
    const experimentId = (payload.experiment_id || "").toString().trim();
    const kind = payload.resolve || payload.kind;
    if (!experimentId) {
      return reject("MISSING_FIELD", "gate.resolve requires experiment_id");
    }
    if (!kind) {
      return reject("GATE_UNKNOWN_KIND", "gate.resolve requires kind or resolve");
    }
    const matches = rows.filter((row) => row.experiment_id === experimentId && row.kind === kind && !row.resolved);
    if (!matches.length) {
      return reject("NOT_FOUND", `no open gate ${kind} on ${experimentId}`);
    }
    for (const gate of matches) {
      gate.resolved = true;
      gate.resolved_reason = payload.reason || "resolved";
      gate.resolved_at = new Date().toISOString();
    }
    return ok({
      gates: rows.filter((row) => row.experiment_id === experimentId).map((row) => ({ ...row })),
    });
  }

  return { list, add, resolve };
}

module.exports = {
  createGateStore,
};
