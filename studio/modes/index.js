"use strict";

/**
 * studio/modes — importable mode rails plus a selectable registry.
 *
 *   const { evaluateRun, createModeRegistry } = require("./studio/modes");
 *   evaluateRun(runRecord).ok === true
 *   const studio = createModeRegistry();
 *   studio.enableMode("eng-coding");
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
const { composeMode } = require("./recipes");
const { CADENCES, validateRoutine } = require("./routines");
const {
  CATALOG_DIR,
  REGISTRY_CODES,
  createModeRegistry,
  loadCatalog,
  fencesOverlap,
} = require("./registry");

const MODES_DIR = path.join(__dirname, "modes");
const LANES_FILE = path.join(__dirname, "lanes.json");
const RECIPES_DIR = path.join(__dirname, "recipes");
const ROUTINES_DIR = path.join(__dirname, "routines");
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const defaultRegistry = createModeRegistry();

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function listByExt(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(ext))
    .map((name) => name.slice(0, -ext.length))
    .sort();
}

function listRailProfiles() {
  return listByExt(MODES_DIR, ".mode.json");
}

function listModes() {
  return defaultRegistry.listModes();
}

function enableMode(id) {
  return defaultRegistry.enableMode(id);
}

function activeMode() {
  return defaultRegistry.activeMode();
}

function assertFalsifier(id) {
  return defaultRegistry.assertFalsifier(id);
}

function listRecipes() {
  return listByExt(RECIPES_DIR, ".recipe.json");
}

function listRoutines() {
  return listByExt(ROUTINES_DIR, ".routine.json");
}

function loadMode(name) {
  const file = path.join(MODES_DIR, `${name}.mode.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`unknown mode "${name}"; have ${listRailProfiles().join(", ")}`);
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

/** A recipe composed over its base mode; throws if the recipe would loosen anything. */
function loadRecipe(name) {
  const file = path.join(RECIPES_DIR, `${name}.recipe.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`unknown recipe "${name}"; have ${listRecipes().join(", ") || "none"}`);
  }
  const recipe = readJson(file);
  return composeMode(loadMode(recipe.base), recipe);
}

function loadRoutine(name, lanes) {
  const file = path.join(ROUTINES_DIR, `${name}.routine.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`unknown routine "${name}"; have ${listRoutines().join(", ") || "none"}`);
  }
  return validateRoutine(readJson(file), lanes || loadLanes());
}

/** The mode a run record is graded under: its recipe if it names one, else its bare mode. */
function resolveMode(run) {
  if (!run.recipe) return loadMode(run.mode);
  const mode = loadRecipe(run.recipe);
  if (mode.mode !== run.mode) {
    throw new Error(`record is mode ${run.mode} but recipe ${run.recipe} is built on ${mode.mode}`);
  }
  return mode;
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

  const mode = options.mode || resolveMode(run);
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
    recipe: mode.recipe || null,
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

function listJson(abs) {
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...listJson(child));
    else if (entry.name.endsWith(".json")) out.push(child);
  }
  return out;
}

/**
 * Run a routine's gate once. Returns the exit code the gate would give and whether it matches expect_exit.
 * The cadence is metadata for whatever drives it; this runs exactly once, now.
 */
function runRoutine(name) {
  const routine = loadRoutine(name);
  const target = path.join(REPO_ROOT, routine.target);
  if (!fs.existsSync(target)) throw new Error(`routine ${name} target ${routine.target} does not exist`);
  const reports = listJson(target).map((file) => evaluateFile(file));
  const dirty = reports.filter((report) => !report.ok).length;
  const exit = dirty ? 2 : 0;
  return {
    routine: routine.routine,
    cadence: routine.cadence,
    target: routine.target,
    records: reports.length,
    dirty,
    exit,
    expect_exit: routine.expect_exit,
    ok: reports.length > 0 && exit === routine.expect_exit,
    verdict: null,
    clock_started: false,
  };
}

/**
 * The retained-evidence record for a run: what has to be kept so a stranger can re-run each claim.
 * Derived from the record; nothing is written to disk.
 */
function retainedRecord(run) {
  const measured = new Map();
  for (const row of Array.isArray(run.commands) ? run.commands : []) {
    if (row && typeof row.cmd === "string" && Number.isInteger(row.exit_code)) measured.set(row.cmd.trim(), row.exit_code);
  }
  const claims = (Array.isArray(run.claims) ? run.claims : []).map((claim) => {
    const evidence = Array.isArray(claim && claim.evidence) ? claim.evidence : [];
    return {
      id: (claim && claim.id) || null,
      kill: (claim && claim.kill) || null,
      rerun: evidence
        .filter((item) => item && item.kind === "command" && measured.has(String(item.ref).trim()))
        .map((item) => ({ cmd: item.ref.trim(), exit_code: measured.get(item.ref.trim()) })),
      refs: evidence.filter((item) => item && item.kind !== "command").map((item) => `${item.kind}:${item.ref}`),
    };
  });
  return {
    mode: run.mode || null,
    recipe: run.recipe || null,
    lane: run.lane || null,
    base: (run.retain && run.retain.base) || null,
    claims,
    verdict: null,
    clock_started: false,
  };
}

module.exports = {
  RAILS,
  VIOLATION_CODES,
  REGISTRY_CODES,
  MODES_DIR,
  CATALOG_DIR,
  LANES_FILE,
  RECIPES_DIR,
  ROUTINES_DIR,
  CADENCES,
  composeMode,
  createModeRegistry,
  loadCatalog,
  fencesOverlap,
  listRailProfiles,
  listModes,
  enableMode,
  activeMode,
  assertFalsifier,
  listRecipes,
  listRoutines,
  loadMode,
  loadRecipe,
  loadRoutine,
  loadLanes,
  resolveMode,
  runRoutine,
  retainedRecord,
  evaluateRun,
  evaluateFile,
  normalizePath,
  underPrefix,
};
