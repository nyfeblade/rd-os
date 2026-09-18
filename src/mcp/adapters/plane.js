"use strict";

/**
 * Load CA1 control-plane APIs when present; otherwise the in-memory stub.
 *
 * TODO(CA1): `src/board` + `src/lock` are not on main yet (see
 * cursor/ca1-control-plane-620c @ b5b3264). Expected library:
 *
 *   const { createControlPlane } = require("../../board");
 *   plane.lock.acquire / release
 *   plane.thesis.set / get
 *   plane.packets.upsert / index
 *   plane.seats.assign / list
 *   plane.budget.set / list
 *   plane.proof.verdict  — author seat is SEAT_FORBIDDEN
 *   plane.dump
 *
 * Do not copy CA1 SQLite into this lane. Contract + rejects stay testable on the stub.
 */

const { createStubPlane } = require("./stub-plane");

function tryLoadCa1Plane(home) {
  let createControlPlane;
  try {
    ({ createControlPlane } = require("../../board"));
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw err;
  }
  if (typeof createControlPlane !== "function") {
    return null;
  }
  const plane = createControlPlane(home);
  plane.kind = "ca1";
  if (!plane.budget.get) {
    plane.budget.get = function getBudget(experimentId) {
      const listed = plane.budget.list();
      if (!listed.ok) {
        return listed;
      }
      const budgets = listed.data.budgets || [];
      const budget = experimentId ? budgets.find((row) => row.experiment_id === experimentId) || null : null;
      return { ok: true, data: { budget, budgets } };
    };
  }
  return plane;
}

function loadPlane(home) {
  return tryLoadCa1Plane(home) || createStubPlane(home);
}

module.exports = {
  loadPlane,
  tryLoadCa1Plane,
};
