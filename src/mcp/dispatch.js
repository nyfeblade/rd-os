"use strict";

const { reject, assertNeverTool } = require("./reject");
const { TOOLS, isMutator } = require("./tools");
const {
  requireString,
  rejectClockStarted,
  rejectWeekWithoutGate,
  rejectPacket,
  rejectUnknownGateKind,
  rejectUnknownSeatRole,
  actorOf,
} = require("./validate");

function dispatchTool(runtime, tool, payload, ctx) {
  const body = payload && typeof payload === "object" ? payload : {};
  const actor = actorOf(body, ctx);
  const callCtx = { ...(ctx || {}), actor };

  if (!TOOLS.includes(tool)) {
    return reject("UNKNOWN_TOOL", `unknown tool: ${tool}`);
  }

  const clock = rejectClockStarted(body);
  if (clock) {
    return clock;
  }

  if (isMutator(tool)) {
    const key = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
    if (!key) {
      return reject("MISSING_IDEMPOTENCY_KEY", `${tool} requires idempotency_key`);
    }
    const seen = runtime.idempotency.lookup(tool, body);
    if (seen.mode === "replay" || seen.mode === "conflict") {
      return seen.result;
    }
    const result = runTool(runtime, tool, body, callCtx);
    runtime.idempotency.remember(tool, body, result);
    return result;
  }

  return runTool(runtime, tool, body, callCtx);
}

function runTool(runtime, tool, body, ctx) {
  switch (tool) {
    case "board.dump":
      return runtime.plane.dump();
    case "board.get":
      return runtime.plane.thesis.get();
    case "board.set":
      return boardSet(runtime, body);
    case "board.list_seats":
      return runtime.plane.seats.list(body.experiment_id);
    case "board.assign_seat":
      return boardAssignSeat(runtime, body);
    case "packet.index":
      return runtime.plane.packets.index();
    case "packet.upsert":
      return packetUpsert(runtime, body);
    case "lock.acquire":
      return runtime.plane.lock.acquire(body, ctx);
    case "lock.release":
      return runtime.plane.lock.release(body, ctx);
    case "proof.verdict":
      return proofVerdict(runtime, body, ctx);
    case "gate.list":
      return runtime.gates.list(body.experiment_id);
    case "gate.add":
      return gateAdd(runtime, body, ctx);
    case "gate.resolve":
      return gateResolve(runtime, body, ctx);
    case "budget.list":
      return budgetList(runtime, body);
    case "budget.set":
      return budgetSet(runtime, body);
    case "budget.spend":
      return budgetSpend(runtime, body);
    default:
      return assertNeverTool(tool);
  }
}

function boardSet(runtime, body) {
  const missingId = requireString(body, "experiment_id", "MISSING_MACHINE_TIME");
  if (missingId) {
    return missingId;
  }
  const missingTitle = requireString(body, "title", "MISSING_MACHINE_TIME");
  if (missingTitle) {
    return missingTitle;
  }
  const week = rejectWeekWithoutGate(body);
  if (week) {
    return week;
  }
  return runtime.plane.thesis.set(body);
}

function boardAssignSeat(runtime, body) {
  const missingId = requireString(body, "experiment_id", "MISSING_MACHINE_TIME");
  if (missingId) {
    return missingId;
  }
  const role = rejectUnknownSeatRole(body.role);
  if (role) {
    return role;
  }
  return runtime.plane.seats.assign(body);
}

function packetUpsert(runtime, body) {
  const packetReject = rejectPacket(body);
  if (packetReject) {
    return packetReject;
  }
  const packetId = body.packet_id || body.id;
  if (typeof packetId !== "string" || !packetId.trim()) {
    return reject("NO_RESEARCH", "packet.upsert requires packet_id");
  }
  return runtime.plane.packets.upsert(body);
}

function proofVerdict(runtime, body, ctx) {
  if (body.clock_started === true) {
    return reject("CLOCK_STARTED_FORBIDDEN", "proof.verdict must not arm kill14d");
  }
  if (body.kill14d_verdict != null || body.fourteen_day_verdict != null) {
    return reject("SELF_CERT", "proof.verdict is packet-only; Eng Proof owns the 14d verdict");
  }
  return runtime.plane.proof.verdict(body, ctx);
}

function requireHuman(ctx, tool) {
  if (ctx.actor !== "human") {
    return reject("NOT_HUMAN", `${tool} is human only`);
  }
  return null;
}

function gateAdd(runtime, body, ctx) {
  const human = requireHuman(ctx, "gate.add");
  if (human) {
    return human;
  }
  const kind = rejectUnknownGateKind(body.kind);
  if (kind) {
    return kind;
  }
  const week = rejectWeekWithoutGate({ ...body, human_gates: [{ kind: body.kind, reason: body.reason || "" }] });
  if (week) {
    return week;
  }
  return runtime.gates.add(body);
}

function gateResolve(runtime, body, ctx) {
  const human = requireHuman(ctx, "gate.resolve");
  if (human) {
    return human;
  }
  return runtime.gates.resolve(body);
}

function budgetList(runtime, body) {
  if (body.experiment_id && runtime.plane.budget.get) {
    return runtime.plane.budget.get(body.experiment_id);
  }
  return runtime.plane.budget.list();
}

function budgetSet(runtime, body) {
  const missingId = requireString(body, "experiment_id", "MISSING_MACHINE_TIME");
  if (missingId) {
    return missingId;
  }
  if (typeof body.ca_hours_budget !== "number" || typeof body.proof_min_budget !== "number") {
    return reject("MISSING_MACHINE_TIME", "budget.set requires numeric ca_hours_budget and proof_min_budget");
  }
  return runtime.plane.budget.set(body);
}

function budgetSpend(runtime, body) {
  const missingId = requireString(body, "experiment_id", "MISSING_MACHINE_TIME");
  if (missingId) {
    return missingId;
  }
  const caHours = body.ca_hours;
  const proofMin = body.proof_min;
  if (typeof caHours !== "number" && typeof proofMin !== "number") {
    return reject("MISSING_FIELD", "budget.spend requires ca_hours and/or proof_min");
  }

  const current = loadBudget(runtime, body.experiment_id);
  if (!current) {
    return reject("NOT_FOUND", `no budget for ${body.experiment_id}; call budget.set first`);
  }

  const nextCa = current.spent_ca_hours + (typeof caHours === "number" ? caHours : 0);
  const nextProof = current.spent_proof_min + (typeof proofMin === "number" ? proofMin : 0);
  if (nextCa > current.ca_hours_budget || nextProof > current.proof_min_budget) {
    return reject(
      "RESOURCE_EXHAUSTED",
      `budget exhausted on ${body.experiment_id}: spent ca_hours=${nextCa}/${current.ca_hours_budget} proof_min=${nextProof}/${current.proof_min_budget}. STOP; do not retry.`
    );
  }

  // TODO(CA1): call plane.budget.spend when that API exists. Until then, rewrite via set.
  return runtime.plane.budget.set({
    ...body,
    experiment_id: body.experiment_id,
    ca_hours_budget: current.ca_hours_budget,
    proof_min_budget: current.proof_min_budget,
    spent_ca_hours: nextCa,
    spent_proof_min: nextProof,
    lock_token: body.lock_token,
    holder: body.holder,
  });
}

function loadBudget(runtime, experimentId) {
  if (runtime.plane.budget.get) {
    const got = runtime.plane.budget.get(experimentId);
    if (got.ok && got.data && got.data.budget) {
      return got.data.budget;
    }
  }
  const listed = runtime.plane.budget.list();
  if (!listed.ok) {
    return null;
  }
  const budgets = listed.data.budgets || [];
  return budgets.find((row) => row.experiment_id === experimentId) || null;
}

module.exports = {
  dispatchTool,
};
