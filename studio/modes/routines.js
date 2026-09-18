"use strict";

/**
 * Routines: standing rail checks. A routine is cadence metadata plus a gate target and the exit code it expects.
 * Nothing here schedules anything; whatever runs the cadence calls runRoutine and reads the exit code.
 */

const CADENCES = ["on-push", "on-pr", "hourly", "daily", "weekly"];
const { underPrefix } = require("./rails");

// A routine says how often, not when: no wall-clock scheduling, and never a verdict.
const RESERVED = ["verdict", "schedule_at", "cron"];

function validateRoutine(routine, lanes) {
  const name = routine && routine.routine;
  if (!name) throw new Error("routine has no name");
  if (!CADENCES.includes(routine.cadence)) {
    throw new Error(`routine ${name} cadence ${JSON.stringify(routine.cadence)} not in ${CADENCES.join("|")}`);
  }
  for (const key of RESERVED) {
    if (Object.prototype.hasOwnProperty.call(routine, key)) {
      throw new Error(`routine ${name} carries reserved field ${key}`);
    }
  }
  if (routine.clock_started === true) throw new Error(`routine ${name} tries to arm the clock`);
  if (routine.expect_exit !== 0 && routine.expect_exit !== 2) {
    throw new Error(`routine ${name} expect_exit must be 0 (all clean) or 2 (rails bite)`);
  }
  if (typeof routine.target !== "string" || !routine.target.trim()) {
    throw new Error(`routine ${name} has no target`);
  }
  const registry = (lanes && lanes.lanes) || {};
  if (!Object.prototype.hasOwnProperty.call(registry, routine.owner_lane)) {
    throw new Error(`routine ${name} owner_lane ${JSON.stringify(routine.owner_lane)} is not a registered lane`);
  }
  const owns = registry[routine.owner_lane].owns || [];
  if (!owns.some((prefix) => underPrefix(routine.target, prefix))) {
    throw new Error(`routine ${name} target ${routine.target} is outside ${routine.owner_lane}'s fence`);
  }
  return routine;
}

module.exports = { CADENCES, validateRoutine };
