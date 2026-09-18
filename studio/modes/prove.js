#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible mode-rail prove script.
 *
 *   node studio/modes/prove.js
 *     Runs every fixture against the rails and checks each fixture's own `expect`
 *     block. Exit 0 only if the rails agree with every expectation.
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

  const names = modes.listModes();
  if (names.length === 0) fail("modes", "no .mode.json files found");
  for (const name of names) {
    const mode = modes.loadMode(name);
    for (const rail of mode.rails) {
      if (!modes.RAILS.includes(rail)) fail(`mode ${name}`, `unknown rail ${rail}`);
    }
    if (mode.rails.length !== modes.RAILS.length) {
      fail(`mode ${name}`, `enables ${mode.rails.length}/${modes.RAILS.length} rails; all three are mandatory`);
    }
  }
  pass(`modes load with all rails enabled (${names.join(", ")})`);

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
