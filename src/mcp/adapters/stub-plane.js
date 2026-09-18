"use strict";

/**
 * In-memory stand-in for CA1 `createControlPlane`.
 * TODO(CA1): delete this path once `src/board` is on main; `loadPlane` will require it.
 * Shapes and reject codes match cursor/ca1-control-plane-620c (b5b3264).
 */

const crypto = require("crypto");
const { reject, ok } = require("../reject");

const BOARD_RESOURCE = "board";

function nowIso() {
  return new Date().toISOString();
}

function actorOf(payload, ctx) {
  if (payload && typeof payload.actor === "string" && payload.actor.trim()) {
    return payload.actor.trim();
  }
  if (ctx && typeof ctx.actor === "string" && ctx.actor.trim()) {
    return ctx.actor.trim();
  }
  return "agent";
}

function resourceOf(payload) {
  return (payload && payload.resource) || BOARD_RESOURCE;
}

function holderOf(payload, ctx) {
  if (payload && typeof payload.holder === "string" && payload.holder.trim()) {
    return payload.holder.trim();
  }
  return actorOf(payload, ctx);
}

function tokenOf(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (typeof payload.lock_token === "string" && payload.lock_token.trim()) {
    return payload.lock_token.trim();
  }
  if (typeof payload.token === "string" && payload.token.trim()) {
    return payload.token.trim();
  }
  return null;
}

function packetCompleteness(payload) {
  const source = payload && typeof payload === "object" ? payload.packet || payload : {};
  const fields = ["estimate_ca_hours", "estimate_proof_min", "human_gates", "actuals"];
  const present = fields.filter((field) => source[field] !== undefined);
  return present.length / fields.length;
}

function canSetVerdict(role) {
  switch (role) {
    case "proof":
      return true;
    case "author":
    case "human":
      return false;
    default:
      throw new Error(`unhandled SeatRole: ${role}`);
  }
}

function createStubPlane() {
  const state = {
    thesis: null,
    packets: new Map(),
    locks: new Map(),
    seats: new Map(),
    budgets: new Map(),
  };

  function loadLock(resource) {
    return state.locks.get(resource) || null;
  }

  function listLocks() {
    return [...state.locks.values()].sort((a, b) => a.resource.localeCompare(b.resource));
  }

  function listPackets() {
    return [...state.packets.values()].sort((a, b) => {
      if (a.created_at === b.created_at) {
        return a.packet_id.localeCompare(b.packet_id);
      }
      return a.created_at.localeCompare(b.created_at);
    });
  }

  function seatKey(experimentId, actor) {
    return `${experimentId}::${actor}`;
  }

  function listSeats(experimentId) {
    const rows = [...state.seats.values()];
    const filtered = experimentId ? rows.filter((row) => row.experiment_id === experimentId) : rows;
    return filtered.sort((a, b) => {
      if (a.experiment_id === b.experiment_id) {
        return a.actor.localeCompare(b.actor);
      }
      return a.experiment_id.localeCompare(b.experiment_id);
    });
  }

  function loadSeat(experimentId, actor) {
    return state.seats.get(seatKey(experimentId, actor)) || null;
  }

  function listBudgets() {
    return [...state.budgets.values()].sort((a, b) => a.experiment_id.localeCompare(b.experiment_id));
  }

  function requireWriter(payload) {
    const resource = resourceOf(payload);
    const token = tokenOf(payload);
    const existing = loadLock(resource);
    if (!existing) {
      return reject("LOCK_REQUIRED", `write requires lock.acquire on ${resource}`);
    }
    if (!token || token !== existing.token) {
      return reject("LOCK_REQUIRED", `write requires lock_token for ${resource}`);
    }
    return ok(existing);
  }

  function acquire(payload, ctx) {
    const resource = resourceOf(payload);
    const holder = holderOf(payload, ctx);
    const existing = loadLock(resource);
    if (existing) {
      if (existing.holder === holder) {
        return ok({
          resource: existing.resource,
          holder: existing.holder,
          token: existing.token,
          acquired_at: existing.acquired_at,
          refreshed: true,
        });
      }
      return reject("LOCK_HELD", `${resource} held by ${existing.holder}; one writer`);
    }
    const token = `lk-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const acquiredAt = nowIso();
    const row = { resource, holder, token, acquired_at: acquiredAt };
    state.locks.set(resource, row);
    return ok({ ...row, refreshed: false });
  }

  function release(payload, ctx) {
    const resource = resourceOf(payload);
    const holder = holderOf(payload, ctx);
    const token = tokenOf(payload);
    const existing = loadLock(resource);
    if (!existing) {
      return reject("LOCK_REQUIRED", `no lock on ${resource}`);
    }
    if (existing.token !== token || existing.holder !== holder) {
      return reject("LOCK_HELD", "release requires the holder and lock_token");
    }
    state.locks.delete(resource);
    return ok({ resource, released: true, holder });
  }

  function setThesis(payload) {
    const locked = requireWriter(payload);
    if (!locked.ok) {
      return locked;
    }
    if (typeof payload.experiment_id !== "string" || !payload.experiment_id.trim()) {
      return reject("MISSING_MACHINE_TIME", "thesis.set requires experiment_id");
    }
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return reject("MISSING_MACHINE_TIME", "thesis.set requires title");
    }
    state.thesis = {
      experiment_id: payload.experiment_id.trim(),
      title: payload.title.trim(),
      kill: payload.kill || null,
      instrument: payload.instrument || null,
      status: "ACTIVE",
      updated_at: nowIso(),
    };
    return ok({ thesis: { ...state.thesis } });
  }

  function upsertPacket(payload) {
    const locked = requireWriter(payload);
    if (!locked.ok) {
      return locked;
    }
    const packetId = (payload.packet_id || payload.id || "").toString().trim();
    const experimentId = (payload.experiment_id || "").toString().trim();
    if (!packetId) {
      return reject("NO_RESEARCH", "packets.upsert requires packet_id");
    }
    if (!experimentId) {
      return reject("MISSING_MACHINE_TIME", "packets.upsert requires experiment_id");
    }
    if (payload.verdict != null) {
      return reject("SELF_CERT", "packet verdict is proof.verdict only");
    }
    const existing = state.packets.get(packetId);
    const createdAt = existing ? existing.created_at : nowIso();
    const completeness = typeof payload.completeness === "number" ? payload.completeness : packetCompleteness(payload);
    const row = {
      packet_id: packetId,
      experiment_id: experimentId,
      kind: payload.kind || null,
      uri: payload.uri || payload.packet_uri || payload.evidence_uri || null,
      completeness,
      runner_result: payload.runner_result || null,
      verdict: existing ? existing.verdict : null,
      created_at: createdAt,
      updated_at: nowIso(),
    };
    state.packets.set(packetId, row);
    return ok({ packet: { ...row } });
  }

  function assignSeat(payload) {
    const locked = requireWriter(payload);
    if (!locked.ok) {
      return locked;
    }
    const experimentId = (payload.experiment_id || "").toString().trim();
    const actor = (payload.seat_actor || payload.assignee || "").toString().trim();
    const role = payload.role;
    if (!experimentId) {
      return reject("MISSING_MACHINE_TIME", "seats.assign requires experiment_id");
    }
    if (!actor) {
      return reject("SEAT_FORBIDDEN", "seats.assign requires seat_actor");
    }
    switch (role) {
      case "author":
      case "proof":
      case "human":
        break;
      default:
        return reject("SEAT_FORBIDDEN", "seats.assign requires role author|proof|human");
    }
    const seat = { experiment_id: experimentId, actor, role };
    state.seats.set(seatKey(experimentId, actor), seat);
    return ok({ seat: { ...seat }, seats: listSeats(experimentId) });
  }

  function setBudget(payload) {
    const locked = requireWriter(payload);
    if (!locked.ok) {
      return locked;
    }
    const experimentId = (payload.experiment_id || "").toString().trim();
    if (!experimentId) {
      return reject("MISSING_MACHINE_TIME", "budget.set requires experiment_id");
    }
    if (typeof payload.ca_hours_budget !== "number" || typeof payload.proof_min_budget !== "number") {
      return reject("MISSING_MACHINE_TIME", "budget.set requires numeric ca_hours_budget and proof_min_budget");
    }
    const row = {
      experiment_id: experimentId,
      ca_hours_budget: payload.ca_hours_budget,
      proof_min_budget: payload.proof_min_budget,
      spent_ca_hours: typeof payload.spent_ca_hours === "number" ? payload.spent_ca_hours : 0,
      spent_proof_min: typeof payload.spent_proof_min === "number" ? payload.spent_proof_min : 0,
      updated_at: nowIso(),
    };
    state.budgets.set(experimentId, row);
    return ok({ budget: { ...row } });
  }

  function proofVerdict(payload, ctx) {
    const experimentId = (payload.experiment_id || "").toString().trim();
    const packetId = (payload.packet_id || payload.id || "").toString().trim();
    const actor = actorOf(payload, ctx);
    if (!experimentId) {
      return reject("MISSING_MACHINE_TIME", "proof.verdict requires experiment_id");
    }
    if (!packetId) {
      return reject("NO_RESEARCH", "proof.verdict requires packet_id");
    }
    if (payload.verdict == null || payload.verdict === "") {
      return reject("SELF_CERT", "proof.verdict requires a packet verdict string");
    }

    const seat = loadSeat(experimentId, actor);
    const role = seat ? seat.role : "author";
    if (!canSetVerdict(role)) {
      return reject("SEAT_FORBIDDEN", `author cannot proof.verdict (actor=${actor}, role=${role})`);
    }

    const locked = requireWriter(payload);
    if (!locked.ok) {
      return locked;
    }

    const packet = state.packets.get(packetId);
    if (!packet || packet.experiment_id !== experimentId) {
      return reject("NO_RESEARCH", `packet not on board index: ${packetId}`);
    }

    packet.verdict = String(payload.verdict);
    packet.updated_at = nowIso();
    return ok({
      packet: { ...packet },
      seat,
      note: "packet verdict only; kill14d clock stays unarmed; Eng Proof owns 14d verdict",
    });
  }

  function dumpBoard() {
    return {
      thesis: state.thesis ? { ...state.thesis } : null,
      packets: listPackets().map((row) => ({ ...row })),
      locks: listLocks().map((row) => ({
        resource: row.resource,
        holder: row.holder,
        acquired_at: row.acquired_at,
      })),
      seats: listSeats(),
      budgets: listBudgets().map((row) => ({ ...row })),
    };
  }

  return {
    kind: "stub",
    // TODO(CA1): this in-memory plane is replaced when src/board is require-able.
    lock: {
      acquire(payload, ctx) {
        return acquire(payload || {}, ctx);
      },
      release(payload, ctx) {
        return release(payload || {}, ctx);
      },
      requireWriter(payload) {
        return requireWriter(payload || {});
      },
    },
    dump() {
      return ok(dumpBoard());
    },
    thesis: {
      get() {
        return ok({ thesis: state.thesis ? { ...state.thesis } : null });
      },
      set(payload) {
        return setThesis(payload || {});
      },
    },
    packets: {
      index() {
        return ok({ packets: listPackets().map((row) => ({ ...row })) });
      },
      upsert(payload) {
        return upsertPacket(payload || {});
      },
    },
    seats: {
      list(experimentId) {
        return ok({ seats: listSeats(experimentId) });
      },
      assign(payload) {
        return assignSeat(payload || {});
      },
    },
    budget: {
      list() {
        return ok({ budgets: listBudgets().map((row) => ({ ...row })) });
      },
      get(experimentId) {
        const row = experimentId ? state.budgets.get(experimentId) : null;
        return ok({ budget: row ? { ...row } : null, budgets: listBudgets().map((item) => ({ ...item })) });
      },
      set(payload) {
        return setBudget(payload || {});
      },
    },
    proof: {
      verdict(payload, ctx) {
        return proofVerdict(payload || {}, ctx);
      },
    },
  };
}

module.exports = {
  createStubPlane,
  packetCompleteness,
};
