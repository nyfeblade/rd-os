#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible mode-rail prove script.
 *
 *   node studio/modes/prove.js
 *     Runs every fixture against the rails and checks each fixture's own `expect`
 *     block. Exit 0 only if the rails agree with every expectation.
 *
 *   node studio/modes/prove.js --routine <name>
 *     Runs one standing routine's gate now. Exit 0 if its gate exit matches expect_exit, else 1.
 *
 *   node studio/modes/prove.js --gate <dir-or-file>
 *     Uses the rails as a gate over run records. Exit 0 if every record is clean,
 *     exit 2 if any rail is violated.
 *
 * Node 18+. No npm install. Does not write a verdict. Does not arm the clock.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const modes = require("./index");

const FIXTURES = path.join(__dirname, "fixtures");

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name, detail) {
  failed += 1;
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
}

function rel(abs) {
  return path.relative(root, abs) || abs;
}

function listRecords(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`no such fixture path: ${target}`);
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...listRecords(child));
    else if (entry.name.endsWith(".json")) out.push(child);
  }
  return out;
}

function uniqueCodes(report) {
  return [...new Set(report.violations.map((row) => row.code))].sort();
}

/** Library self-checks that do not depend on any fixture. */
function checkLibrary() {
  const seen = new Set();
  for (const code of modes.VIOLATION_CODES) {
    if (seen.has(code)) fail("violation codes", `duplicate ${code}`);
    seen.add(code);
  }
  pass(`closed violation set (${modes.VIOLATION_CODES.length} codes)`);

  const names = modes.listRailProfiles();
  if (names.length === 0) fail("rail profiles", "no .mode.json files found");
  for (const name of names) {
    const mode = modes.loadMode(name);
    for (const rail of mode.rails) {
      if (!modes.RAILS.includes(rail)) fail(`mode ${name}`, `unknown rail ${rail}`);
    }
    if (mode.rails.length !== modes.RAILS.length) {
      fail(`mode ${name}`, `enables ${mode.rails.length}/${modes.RAILS.length} rails; all three are mandatory`);
    }
  }
  pass(`rail profiles load with all rails enabled (${names.join(", ")})`);

  // The registry must not hand the same path to two lanes, or rail 2 has nothing to say.
  const lanes = modes.loadLanes().lanes;
  const owned = [];
  for (const [lane, row] of Object.entries(lanes)) {
    for (const prefix of row.owns) owned.push({ lane, prefix: modes.normalizePath(prefix) });
  }
  let overlaps = 0;
  for (const a of owned) {
    for (const b of owned) {
      if (a.lane === b.lane) continue;
      if (modes.underPrefix(a.prefix, b.prefix)) {
        fail("lane registry", `${a.lane}:${a.prefix} sits inside ${b.lane}:${b.prefix}`);
        overlaps += 1;
      }
    }
  }
  if (overlaps === 0) pass(`lane registry fences are non-overlapping (${owned.length} prefixes)`);

  // The library pins verdict/clock no matter what a run record says.
  const forced = modes.evaluateRun({
    mode: "eng",
    lane: "studio-d-modes",
    verdict: "PASS",
    clock_started: true,
    claims: [],
  });
  if (forced.verdict !== null || forced.clock_started !== false) {
    fail("report pins", JSON.stringify({ verdict: forced.verdict, clock_started: forced.clock_started }));
  } else {
    pass("report keeps verdict=null and clock_started=false");
  }
}

function mustThrow(label, fn, pattern) {
  try {
    fn();
  } catch (err) {
    if (pattern.test(err.message)) return pass(`${label} is refused`);
    return fail(label, `threw the wrong error: ${err.message}`);
  }
  fail(label, "was accepted");
}

const SHIPPED_MODE_IDS = ["eng-coding", "no-self-cert", "research-before-claim"];

/** Product registry: selectable rails with falsifiers, callable by later seats/chat-engine. */
function checkRegistry() {
  const session = modes.createModeRegistry();
  const listed = session.listModes();
  if (!listed.ok || listed.verdict !== null || listed.clock_started !== false) {
    return fail("registry list", JSON.stringify(listed));
  }
  const ids = listed.data.modes.map((row) => row.id);
  if (ids.join(" ") !== SHIPPED_MODE_IDS.join(" ")) {
    fail("registry catalog", `expected [${SHIPPED_MODE_IDS.join(",")}], got [${ids.join(",")}]`);
  } else {
    pass(`registry ships ${ids.join(", ")}`);
  }

  for (const row of listed.data.modes) {
    if (!row.falsifier || !row.falsifier.trim()) {
      fail(`registry ${row.id}`, "missing falsifier");
    } else if (!Array.isArray(row.fences) || row.fences.length === 0) {
      fail(`registry ${row.id}`, "missing lane fences");
    } else if (!modes.RAILS.includes(row.rail)) {
      fail(`registry ${row.id}`, `unknown rail ${row.rail}`);
    } else {
      pass(`registry ${row.id} has rail=${row.rail} fences=${row.fences.join("|")}`);
    }
  }

  const catalog = listed.data.modes;
  let catalogOverlap = 0;
  for (let i = 0; i < catalog.length; i += 1) {
    for (let j = i + 1; j < catalog.length; j += 1) {
      if (modes.fencesOverlap(catalog[i].fences, catalog[j].fences)) {
        fail("registry fences", `${catalog[i].id} overlaps ${catalog[j].id}`);
        catalogOverlap += 1;
      }
    }
  }
  if (catalogOverlap === 0) pass("shipped catalog fences do not overlap");

  for (const id of SHIPPED_MODE_IDS) {
    const enabled = session.enableMode(id);
    if (!enabled.ok) fail(`enable ${id}`, `${enabled.code} ${enabled.detail}`);
  }
  const active = session.activeMode();
  if (!active.ok || !active.data.mode || active.data.mode.id !== "research-before-claim") {
    fail("activeMode", JSON.stringify(active));
  } else {
    pass("three shipped modes enable without LANE_COLLISION");
  }

  for (const id of SHIPPED_MODE_IDS) {
    const proof = session.assertFalsifier(id);
    if (!proof.ok) fail(`assertFalsifier ${id}`, `${proof.code} ${proof.detail}`);
    else pass(`assertFalsifier ${id} trips ${proof.data.code}`);
  }

  const collide = modes.createModeRegistry({
    extra: [
      {
        id: "overlap-coding",
        rail: "multi-lane-awareness",
        falsifier: "Planted overlap used only to prove LANE_COLLISION on enable.",
        fences: ["studio/modes/index.js"],
        planted: { file: "fixtures/planted/lane-collision.json", expect_code: "LANE_COLLISION" },
      },
    ],
  });
  const first = collide.enableMode("eng-coding");
  const second = collide.enableMode("overlap-coding");
  if (!first.ok) fail("collision setup", first.detail);
  else if (second.ok || second.code !== "LANE_COLLISION") {
    fail("LANE_COLLISION", `expected LANE_COLLISION, got ${JSON.stringify(second)}`);
  } else if (collide.activeMode().data.mode.id !== "eng-coding") {
    fail("LANE_COLLISION", "failed enable mutated activeMode");
  } else {
    pass("overlapping fences reject enableMode with LANE_COLLISION");
  }

  const life = session.enableMode("life.food");
  if (!life.ok && life.code === "LIFE_OS_DENIED") pass("life-OS mode id is refused");
  else fail("life-OS", JSON.stringify(life));
}

/** Recipes compose modes; they may only tighten. */
function checkRecipes() {
  const names = modes.listRecipes();
  if (names.length === 0) fail("recipes", "no .recipe.json files found");
  for (const name of names) {
    let composed;
    try {
      composed = modes.loadRecipe(name);
    } catch (err) {
      fail(`recipe ${name}`, err.message);
      continue;
    }
    const base = modes.loadMode(composed.mode);
    if (composed.rails.length !== modes.RAILS.length) fail(`recipe ${name}`, "does not enable all three rails");
    if (composed.min_evidence < base.min_evidence) fail(`recipe ${name}`, "loosened min_evidence");
    for (const word of base.verdict_words) {
      if (!composed.verdict_words.includes(word)) fail(`recipe ${name}`, `dropped reserved word ${word}`);
    }
  }
  pass(`recipes compose over their base mode and only tighten (${names.join(", ")})`);

  const eng = modes.loadMode("eng");
  const r = (tighten, extra) => ({ recipe: "planted", base: "eng", tighten, ...extra });
  mustThrow("recipe dropping a rail", () => modes.composeMode(eng, r({}, { rails: ["research-before-claim", "multi-lane-awareness"] })), /drops rail no-self-cert/);
  mustThrow("recipe lowering min_evidence", () => modes.composeMode(eng, r({ min_evidence: 0 })), /lowers min_evidence/);
  mustThrow("recipe switching off measured evidence", () => modes.composeMode(eng, r({ require_measured_evidence: false })), /only set require_measured_evidence to true/);
  mustThrow("recipe widening evidence kinds", () => modes.composeMode(eng, r({ evidence_kinds: ["command", "vibes"] })), /only narrow evidence_kinds/);
  mustThrow("recipe with an unknown knob", () => modes.composeMode(eng, r({ verdict: "PASS" })), /unknown field verdict/);
  mustThrow("recipe on the wrong base", () => modes.composeMode(eng, { recipe: "planted", base: "design", tighten: {} }), /built on "design"/);
}

/** Routines are cadence metadata over a gate; each one is run once, now. */
function checkRoutines() {
  const names = modes.listRoutines();
  if (names.length === 0) fail("routines", "no .routine.json files found");
  let bites = 0;
  for (const name of names) {
    let result;
    try {
      result = modes.runRoutine(name);
    } catch (err) {
      fail(`routine ${name}`, err.message);
      continue;
    }
    if (result.expect_exit === 2) bites += 1;
    if (result.ok) pass(`routine ${name} [${result.cadence}] gate exit ${result.exit} over ${result.records} records`);
    else fail(`routine ${name}`, `expected gate exit ${result.expect_exit}, got ${result.exit} over ${result.records} records`);
  }
  if (bites === 0) fail("routines", "no routine expects the rails to bite");

  const lanes = modes.loadLanes();
  const base = { routine: "planted", cadence: "daily", owner_lane: "studio-d-modes", target: "studio/modes/fixtures/good", expect_exit: 0 };
  const { validateRoutine } = require("./routines");
  mustThrow("routine with an unknown cadence", () => validateRoutine({ ...base, cadence: "every-tuesday-9am" }, lanes), /cadence/);
  mustThrow("routine with a cron line", () => validateRoutine({ ...base, cron: "0 9 * * 1" }, lanes), /reserved field cron/);
  mustThrow("routine writing a verdict", () => validateRoutine({ ...base, verdict: "PASS" }, lanes), /reserved field verdict/);
  mustThrow("routine arming the clock", () => validateRoutine({ ...base, clock_started: true }, lanes), /arm the clock/);
  mustThrow("routine gating another lane's paths", () => validateRoutine({ ...base, target: "studio/shell" }, lanes), /outside studio-d-modes's fence/);
}

/** Retained evidence: the record a stranger needs to re-run each claim. */
function checkRetained() {
  const file = path.join(FIXTURES, "good", "eng-rerunnable.json");
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  const kept = modes.retainedRecord(run);
  const retained = new Map((run.retain.rerun || []).map((row) => [row.cmd, row.exit_code]));
  let gaps = 0;
  for (const claim of kept.claims) {
    if (claim.rerun.length === 0) gaps += 1;
    for (const row of claim.rerun) if (retained.get(row.cmd) !== row.exit_code) gaps += 1;
  }
  if (!kept.base || gaps || kept.verdict !== null || kept.clock_started !== false) {
    fail("retained record", JSON.stringify(kept));
  } else {
    pass(`retained record re-runs ${kept.claims.length} claims against ${kept.base}`);
  }
}

/** Every fixture is checked against its own declared expectation. */
function checkFixtures() {
  const files = listRecords(FIXTURES);
  if (files.length === 0) fail("fixtures", "none found");

  let good = 0;
  let planted = 0;

  for (const file of files) {
    const name = rel(file);
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const expect = record.expect;
    if (!expect || typeof expect.ok !== "boolean") {
      fail(name, "fixture has no expect.ok block");
      continue;
    }

    let report;
    try {
      report = modes.evaluateRun(record);
    } catch (err) {
      fail(name, `evaluateRun threw: ${err.message}`);
      continue;
    }

    if (report.ok !== expect.ok) {
      fail(name, `expected ok=${expect.ok}, got ok=${report.ok} [${uniqueCodes(report).join(",") || "none"}]`);
      continue;
    }

    if (expect.ok) {
      good += 1;
      pass(`${name} clears all rails`);
      continue;
    }

    planted += 1;
    const got = uniqueCodes(report);
    const want = [...(expect.violations || [])].sort();
    if (got.join(" ") !== want.join(" ")) {
      fail(name, `expected violations [${want.join(",")}], got [${got.join(",")}]`);
    } else {
      pass(`${name} trips ${got.join(",")}`);
    }
  }

  if (good === 0) fail("fixtures", "no good fixtures; rails could be rejecting everything");
  if (planted === 0) fail("fixtures", "no planted fixtures; rails could be accepting everything");

  // The headline claim of this lane, measured rather than asserted.
  const plantedDir = path.join(FIXTURES, "planted");
  const anyClean = listRecords(plantedDir).some((file) => modes.evaluateFile(file).ok);
  if (anyClean) fail("gate", "a planted record cleared the rails");
  else pass("every planted record is caught by at least one rail");
}

/** Gate mode: run records in, exit code out. */
function gate(target) {
  const files = listRecords(target);
  let dirty = 0;
  for (const file of files) {
    const report = modes.evaluateFile(file);
    if (report.ok) {
      process.stdout.write(`OK   ${rel(file)} [${report.mode}/${report.lane}]\n`);
      continue;
    }
    dirty += 1;
    for (const row of report.violations) {
      process.stderr.write(`RAIL ${rel(file)} ${row.code} ${row.rail} at ${row.where}: ${row.detail}\n`);
    }
  }
  process.stdout.write(
    `mode-rail gate: ${files.length - dirty}/${files.length} records clean; verdict=null; clock_started=false\n`
  );
  process.exit(dirty ? 2 : 0);
}

function main() {
  const argv = process.argv.slice(2);
  const routineAt = argv.indexOf("--routine");
  if (routineAt !== -1) {
    const name = argv[routineAt + 1];
    if (!name) {
      process.stderr.write(`--routine needs a name; have ${modes.listRoutines().join(", ")}\n`);
      process.exit(2);
    }
    const result = modes.runRoutine(name);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  const gateAt = argv.indexOf("--gate");
  if (gateAt !== -1) {
    const target = argv[gateAt + 1];
    if (!target) {
      process.stderr.write("--gate needs a file or directory\n");
      process.exit(2);
    }
    gate(target);
    return;
  }

  checkLibrary();
  checkRegistry();
  checkRecipes();
  checkRoutines();
  checkRetained();
  checkFixtures();
  process.stdout.write(
    `mode rails ${passed} passed, ${failed} failed; verdict=null; clock_started=false; not a 14d verdict\n`
  );
  process.exit(failed ? 1 : 0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`ERROR ${err.message}\n`);
  process.exit(1);
}
