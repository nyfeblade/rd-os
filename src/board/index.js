"use strict";

// Library API for other CAs. Not wired into MCP/kernel in this wedge.
//   const { createControlPlane } = require("./src/board");
//   const plane = createControlPlane(home);
//   plane.lock.acquire({ holder }) / plane.lock.release({ holder, lock_token })
//   plane.thesis.set / plane.packets.upsert / plane.seats.assign / plane.budget.set
//   plane.proof.verdict — author seat is SEAT_FORBIDDEN

const { openDb } = require("../db/sqlite");
const { acquire, release, requireWriter, listLocks } = require("../lock");

const PACKET_FIELDS = ["estimate_ca_hours", "estimate_proof_min", "human_gates", "actuals"];

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNeverSeatRole(role) {
  throw new Error(`unhandled SeatRole: ${role}`);
}

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

function packetCompleteness(payload) {
  const source = payload && typeof payload === "object" ? payload.packet || payload : {};
  const present = PACKET_FIELDS.filter((field) => source[field] !== undefined);
  return present.length / PACKET_FIELDS.length;
}

function canSetVerdict(role) {
  switch (role) {
    case "proof":
      return true;
    case "author":
    case "human":
      return false;
    default:
      return assertNeverSeatRole(role);
  }
}

function loadThesis(db) {
  return db.prepare(
    "SELECT experiment_id, title, kill, instrument, status, updated_at FROM thesis WHERE slot = 1"
  ).get() || null;
}

function listPackets(db) {
  return db.prepare(
    `SELECT packet_id, experiment_id, kind, uri, completeness, runner_result, verdict, created_at, updated_at
     FROM packets ORDER BY created_at, packet_id`
  ).all();
}

function listSeats(db, experimentId) {
  if (experimentId) {
    return db.prepare(
      "SELECT experiment_id, actor, role FROM seats WHERE experiment_id = ? ORDER BY actor"
    ).all(experimentId);
  }
  return db.prepare("SELECT experiment_id, actor, role FROM seats ORDER BY experiment_id, actor").all();
}

function loadSeat(db, experimentId, actor) {
  return db.prepare(
    "SELECT experiment_id, actor, role FROM seats WHERE experiment_id = ? AND actor = ?"
  ).get(experimentId, actor) || null;
}

function listBudgets(db) {
  return db.prepare(
    `SELECT experiment_id, ca_hours_budget, proof_min_budget, spent_ca_hours, spent_proof_min, updated_at
     FROM budgets ORDER BY experiment_id`
  ).all();
}

function dumpBoard(db) {
  return {
    thesis: loadThesis(db),
    packets: listPackets(db),
    locks: listLocks(db).map((row) => ({
      resource: row.resource,
      holder: row.holder,
      acquired_at: row.acquired_at,
    })),
    seats: listSeats(db),
    budgets: listBudgets(db),
  };
}

function setThesis(db, payload) {
  const locked = requireWriter(db, payload);
  if (!locked.ok) {
    return locked;
  }
  if (typeof payload.experiment_id !== "string" || !payload.experiment_id.trim()) {
    return reject("MISSING_MACHINE_TIME", "thesis.set requires experiment_id");
  }
  if (typeof payload.title !== "string" || !payload.title.trim()) {
    return reject("MISSING_MACHINE_TIME", "thesis.set requires title");
  }
  const row = {
    experiment_id: payload.experiment_id.trim(),
    title: payload.title.trim(),
    kill: payload.kill || null,
    instrument: payload.instrument || null,
    status: "ACTIVE",
    updated_at: nowIso(),
  };
  db.prepare(
    `INSERT INTO thesis (slot, experiment_id, title, kill, instrument, status, updated_at)
     VALUES (1, ?, ?, ?, ?, 'ACTIVE', ?)
     ON CONFLICT(slot) DO UPDATE SET
       experiment_id = excluded.experiment_id,
       title = excluded.title,
       kill = excluded.kill,
       instrument = excluded.instrument,
       status = 'ACTIVE',
       updated_at = excluded.updated_at`
  ).run(row.experiment_id, row.title, row.kill, row.instrument, row.updated_at);
  return ok({ thesis: loadThesis(db) });
}

function upsertPacket(db, payload) {
  const locked = requireWriter(db, payload);
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
  const existing = db.prepare("SELECT created_at FROM packets WHERE packet_id = ?").get(packetId);
  const createdAt = existing ? existing.created_at : nowIso();
  const updatedAt = nowIso();
  const completeness = typeof payload.completeness === "number" ? payload.completeness : packetCompleteness(payload);
  const verdict = payload.verdict == null ? null : payload.verdict;
  if (verdict != null) {
    return reject("SELF_CERT", "packet verdict is proof.verdict only");
  }
  db.prepare(
    `INSERT INTO packets (
       packet_id, experiment_id, kind, uri, completeness, runner_result, verdict, payload_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(packet_id) DO UPDATE SET
       experiment_id = excluded.experiment_id,
       kind = excluded.kind,
       uri = excluded.uri,
       completeness = excluded.completeness,
       runner_result = excluded.runner_result,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`
  ).run(
    packetId,
    experimentId,
    payload.kind || null,
    payload.uri || payload.packet_uri || payload.evidence_uri || null,
    completeness,
    payload.runner_result || null,
    JSON.stringify(payload.packet || payload),
    createdAt,
    updatedAt
  );
  return ok({
    packet: db.prepare(
      `SELECT packet_id, experiment_id, kind, uri, completeness, runner_result, verdict, created_at, updated_at
       FROM packets WHERE packet_id = ?`
    ).get(packetId),
  });
}

function assignSeat(db, payload) {
  const locked = requireWriter(db, payload);
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
  db.prepare(
    `INSERT INTO seats (experiment_id, actor, role) VALUES (?, ?, ?)
     ON CONFLICT(experiment_id, actor) DO UPDATE SET role = excluded.role`
  ).run(experimentId, actor, role);
  return ok({ seat: loadSeat(db, experimentId, actor), seats: listSeats(db, experimentId) });
}

function setBudget(db, payload) {
  const locked = requireWriter(db, payload);
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
  const spentCa = typeof payload.spent_ca_hours === "number" ? payload.spent_ca_hours : 0;
  const spentProof = typeof payload.spent_proof_min === "number" ? payload.spent_proof_min : 0;
  const updatedAt = nowIso();
  db.prepare(
    `INSERT INTO budgets (
       experiment_id, ca_hours_budget, proof_min_budget, spent_ca_hours, spent_proof_min, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(experiment_id) DO UPDATE SET
       ca_hours_budget = excluded.ca_hours_budget,
       proof_min_budget = excluded.proof_min_budget,
       spent_ca_hours = excluded.spent_ca_hours,
       spent_proof_min = excluded.spent_proof_min,
       updated_at = excluded.updated_at`
  ).run(experimentId, payload.ca_hours_budget, payload.proof_min_budget, spentCa, spentProof, updatedAt);
  return ok({
    budget: db.prepare(
      `SELECT experiment_id, ca_hours_budget, proof_min_budget, spent_ca_hours, spent_proof_min, updated_at
       FROM budgets WHERE experiment_id = ?`
    ).get(experimentId),
  });
}

function proofVerdict(db, payload, ctx) {
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

  const seat = loadSeat(db, experimentId, actor);
  const role = seat ? seat.role : "author";
  if (!canSetVerdict(role)) {
    return reject("SEAT_FORBIDDEN", `author cannot proof.verdict (actor=${actor}, role=${role})`);
  }

  const locked = requireWriter(db, payload);
  if (!locked.ok) {
    return locked;
  }

  const packet = db.prepare("SELECT packet_id FROM packets WHERE packet_id = ? AND experiment_id = ?").get(
    packetId,
    experimentId
  );
  if (!packet) {
    return reject("NO_RESEARCH", `packet not on board index: ${packetId}`);
  }

  db.prepare("UPDATE packets SET verdict = ?, updated_at = ? WHERE packet_id = ?").run(
    String(payload.verdict),
    nowIso(),
    packetId
  );
  return ok({
    packet: db.prepare(
      `SELECT packet_id, experiment_id, kind, uri, completeness, runner_result, verdict, created_at, updated_at
       FROM packets WHERE packet_id = ?`
    ).get(packetId),
    seat,
    note: "packet verdict only; kill14d clock stays unarmed; Eng Proof owns 14d verdict",
  });
}

function createControlPlane(home) {
  const db = openDb(home);
  return {
    db,
    lock: {
      acquire(payload, ctx) {
        return acquire(db, payload || {}, ctx);
      },
      release(payload, ctx) {
        return release(db, payload || {}, ctx);
      },
      requireWriter(payload) {
        return requireWriter(db, payload || {});
      },
    },
    dump() {
      return ok(dumpBoard(db));
    },
    thesis: {
      get() {
        return ok({ thesis: loadThesis(db) });
      },
      set(payload) {
        return setThesis(db, payload || {});
      },
    },
    packets: {
      index() {
        return ok({ packets: listPackets(db) });
      },
      upsert(payload) {
        return upsertPacket(db, payload || {});
      },
    },
    seats: {
      list(experimentId) {
        return ok({ seats: listSeats(db, experimentId) });
      },
      assign(payload) {
        return assignSeat(db, payload || {});
      },
    },
    budget: {
      list() {
        return ok({ budgets: listBudgets(db) });
      },
      set(payload) {
        return setBudget(db, payload || {});
      },
    },
    proof: {
      verdict(payload, ctx) {
        return proofVerdict(db, payload || {}, ctx);
      },
    },
  };
}

module.exports = {
  createControlPlane,
  packetCompleteness,
};
