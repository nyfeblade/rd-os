"use strict";

/**
 * studio/modes — importable mode rails.
 *
 *   const { evaluateRun } = require("./studio/modes");
 *   const report = evaluateRun(runRecord);
 *   report.ok === true  // no rail violated
 *
 * The library never writes a verdict and never arms a clock. It reports violations.
 */

const fs = require("fs");
const path = require("path");

const {
  RAILS,
  VIOLATION_CODES,
  researchBeforeClaim,
  multiLaneAwareness,
  noSelfCert,
  normalizePath,
  underPrefix,
} = require("./rails");

const MODES_DIR = path.join(__dirname, "modes");
const LANES_FILE = path.join(__dirname, "lanes.json");

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function listModes() {
  return fs
    .readdirSync(MODES_DIR)
    .filter((name) => name.endsWith(".mode.json"))
    .map((name) => name.replace(/\.mode\.json$/, ""))
    .sort();
}

function loadMode(name) {
  const file = path.join(MODES_DIR, `${name}.mode.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`unknown mode "${name}"; have ${listModes().join(", ")}`);
  }
  const mode = readJson(file);
  for (const rail of mode.rails || []) {
    if (!RAILS.includes(rail)) throw new Error(`mode ${name} names unknown rail "${rail}"`);
  }
  return mode;
}

function loadLanes() {
  return readJson(LANES_FILE);
}

/**
 * Evaluate a lane run record against its mode's rails.
 * @param {object} run  lane run record (see README for the shape)
 * @param {object} [opts]
 * @param {object} [opts.mode]   preloaded mode object; defaults to loadMode(run.mode)
 * @param {object} [opts.lanes]  preloaded lane registry; defaults to loadLanes()
 * @returns {{ok:boolean, mode:string, lane:string, rails:string[], violations:object[], counts:object, verdict:null, clock_started:false}}
 */
function evaluateRun(run, opts) {
  const options = opts || {};
  if (!run || typeof run !== "object") throw new Error("evaluateRun needs a run record object");

  const mode = options.mode || loadMode(run.mode);
  const lanes = options.lanes || loadLanes();
  const enabled = Array.isArray(mode.rails) ? mode.rails : RAILS;

  const violations = [];
  if (enabled.includes("research-before-claim")) violations.push(...researchBeforeClaim(run, mode));
  if (enabled.includes("multi-lane-awareness")) violations.push(...multiLaneAwareness(run, mode, lanes));
  if (enabled.includes("no-self-cert")) violations.push(...noSelfCert(run, mode));

  const counts = {};
  for (const row of violations) counts[row.code] = (counts[row.code] || 0) + 1;

  return {
    ok: violations.length === 0,
    mode: mode.mode,
    lane: run.lane || null,
    rails: enabled,
    violations,
    counts,
    // The library grades rails, not work. These stay pinned.
    verdict: null,
    clock_started: false,
  };
}

/** Convenience for gates: read a run record off disk and evaluate it. */
function evaluateFile(file, opts) {
  const report = evaluateRun(readJson(file), opts);
  return { ...report, file };
}

module.exports = {
  RAILS,
  VIOLATION_CODES,
  MODES_DIR,
  LANES_FILE,
  listModes,
  loadMode,
  loadLanes,
  evaluateRun,
  evaluateFile,
  normalizePath,
  underPrefix,
};
