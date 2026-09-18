#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible connectors-runtime prove script.
 *
 *   node studio/connectors/runtime/prove.js
 *     Runs library self-checks and every fixture's `expect` block. Exit 0
 *     only if the contracts agree with every expectation.
 *
 *   node studio/connectors/runtime/prove.js --gate <dir-or-file>
 *     Exit 0 if every fixture in the target evaluates ok=true, exit 2 if any
 *     contract rejects (ok=false). Planted fixtures are expected to bite.
 *
 * Node 18+. No npm install. Does not write a verdict. Does not arm the clock.
 */

const fs = require("fs");
const path = require("path");

const runtime = require("./index");
const contract = require("./contract");

const root = path.resolve(__dirname, "..", "..", "..");
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

function evaluateFixture(record) {
  if (record.op === "ingest") return runtime.ingest(record.envelope);
  if (record.op === "reply") return runtime.reply(record.draft);
  throw new Error(`fixture op must be ingest|reply, got ${JSON.stringify(record.op)}`);
}

function uniqueClosed(name, list) {
  const seen = new Set();
  for (const code of list) {
    if (seen.has(code)) fail(name, `duplicate ${code}`);
    seen.add(code);
  }
  if (seen.size === list.length) pass(`closed ${name} (${list.length})`);
}

function checkLibrary() {
  uniqueClosed("CODES", contract.CODES);
  uniqueClosed("PROVIDERS", contract.PROVIDERS);
  uniqueClosed("OUTBOUND_OPS", contract.OUTBOUND_OPS);
  uniqueClosed("INBOX_KINDS", contract.INBOX_KINDS);
  uniqueClosed("TRAY_STATES", contract.TRAY_STATES);
  uniqueClosed("DEST", contract.DEST);

  const githubEvents = Object.keys(runtime.REGISTRY.github.handlers).sort();
  const wantGithub = contract.GITHUB_EVENTS.slice().sort();
  if (githubEvents.join(" ") !== wantGithub.join(" ")) {
    fail("github handlers", `have [${githubEvents.join(",")}], want [${wantGithub.join(",")}]`);
  } else {
    pass(`github handlers cover ${githubEvents.join(",")}`);
  }

  const slackHandlers = Object.keys(runtime.REGISTRY.slack.handlers).sort();
  if (slackHandlers.join(" ") !== "app_mention message") {
    fail("slack handlers", `have [${slackHandlers.join(",")}]`);
  } else {
    pass("slack handlers cover app_mention,message");
  }

  const pinned = runtime.ingest({
    provider: "github",
    event: "star",
    tray_state: "live",
    payload: {},
  });
  if (pinned.verdict !== null || pinned.clock_started !== false) {
    fail("report pins", JSON.stringify({ verdict: pinned.verdict, clock_started: pinned.clock_started }));
  } else {
    pass("report keeps verdict=null and clock_started=false");
  }

  if (runtime.humanGateAllows({ actor: "human" }) !== true) fail("human gate", "human was blocked");
  else pass("humanGateAllows lets human through");
  if (runtime.humanGateAllows({ actor: "bot" }) !== false) fail("human gate", "ungated bot was allowed");
  else pass("humanGateAllows blocks bot without approved gate");
  if (runtime.humanGateAllows({ actor: "bot", human_gate: { status: "approved" } }) !== true) {
    fail("human gate", "approved bot was blocked");
  } else {
    pass("humanGateAllows lets approved bot through");
  }

  if (runtime.cutoverAllows({ actor: "human" }) !== true) fail("cutover", "human was blocked");
  else pass("cutoverAllows lets human through");
  if (runtime.cutoverAllows({ actor: "bot" }) !== false) fail("cutover", "uncutover bot was allowed");
  else pass("cutoverAllows blocks bot without in-studio-only attach");
  if (runtime.cutoverAllows({ actor: "bot", cutover: { status: "attached", in_studio_only: true } }) !== true) {
    fail("cutover", "attached in-studio-only bot was blocked");
  } else {
    pass("cutoverAllows lets attached in-studio-only bot through");
  }
}

function matchExpect(result, expect) {
  if (result.ok !== expect.ok) {
    return `expected ok=${expect.ok}, got ok=${result.ok} code=${result.code || "none"}`;
  }
  if (expect.ok === false) {
    if (expect.code && result.code !== expect.code) {
      return `expected code=${expect.code}, got ${result.code}`;
    }
    return null;
  }
  if (typeof expect.dropped === "boolean" && result.dropped !== expect.dropped) {
    return `expected dropped=${expect.dropped}, got ${result.dropped}`;
  }
  if (expect.dropped) return null;
  if (expect.kind && (!result.item || result.item.kind !== expect.kind)) {
    return `expected kind=${expect.kind}, got ${result.item && result.item.kind}`;
  }
  if (expect.dest && (!result.item || result.item.dest !== expect.dest)) {
    return `expected dest=${expect.dest}, got ${result.item && result.item.dest}`;
  }
  if (typeof expect.need_you === "boolean" && (!result.item || result.item.need_you !== expect.need_you)) {
    return `expected need_you=${expect.need_you}, got ${result.item && result.item.need_you}`;
  }
  if (typeof expect.needs_gate === "boolean" && (!result.item || result.item.needs_gate !== expect.needs_gate)) {
    return `expected needs_gate=${expect.needs_gate}, got ${result.item && result.item.needs_gate}`;
  }
  if (expect.provider && result.item && result.item.provider !== expect.provider) {
    return `expected provider=${expect.provider}, got ${result.item.provider}`;
  }
  if (expect.outbound_op) {
    if (!result.outbound || result.outbound.op !== expect.outbound_op) {
      return `expected outbound_op=${expect.outbound_op}, got ${result.outbound && result.outbound.op}`;
    }
  }
  if (expect.actor && result.outbound && result.outbound.actor !== expect.actor) {
    return `expected actor=${expect.actor}, got ${result.outbound.actor}`;
  }
  return null;
}

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

    let result;
    try {
      result = evaluateFixture(record);
    } catch (err) {
      fail(name, `evaluate threw: ${err.message}`);
      continue;
    }

    if (result.verdict !== null || result.clock_started !== false) {
      fail(name, `pins drifted: verdict=${JSON.stringify(result.verdict)} clock_started=${result.clock_started}`);
      continue;
    }

    const mismatch = matchExpect(result, expect);
    if (mismatch) {
      fail(name, mismatch);
      continue;
    }

    if (expect.ok) {
      good += 1;
      if (expect.dropped) pass(`${name} dropped as ${result.reason || "NOISE"}`);
      else if (record.op === "reply") pass(`${name} outbound ${result.outbound.op}`);
      else pass(`${name} inbox ${result.item.kind} → ${result.item.dest}`);
    } else {
      planted += 1;
      pass(`${name} trips ${result.code}`);
    }
  }

  if (good === 0) fail("fixtures", "no good fixtures; contracts could be rejecting everything");
  if (planted === 0) fail("fixtures", "no planted fixtures; contracts could be accepting everything");

  const plantedDir = path.join(FIXTURES, "planted");
  const anyClean = listRecords(plantedDir).some((file) => evaluateFixture(JSON.parse(fs.readFileSync(file, "utf8"))).ok);
  if (anyClean) fail("gate", "a planted record cleared the contracts");
  else pass("every planted record is caught by at least one code");

  const plantedCodes = new Set();
  for (const file of listRecords(plantedDir)) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    if (record.expect && record.expect.code) plantedCodes.add(record.expect.code);
  }
  const missing = contract.CODES.filter((code) => !plantedCodes.has(code));
  if (missing.length) fail("planted coverage", `no fixture for ${missing.join(",")}`);
  else pass(`planted fixtures cover every code (${contract.CODES.join(",")})`);
}

function gate(target) {
  const files = listRecords(target);
  let dirty = 0;
  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = evaluateFixture(record);
    if (result.ok) {
      process.stdout.write(`OK   ${rel(file)}\n`);
      continue;
    }
    dirty += 1;
    process.stderr.write(`CODE ${rel(file)} ${result.code}: ${result.detail}\n`);
  }
  process.stdout.write(
    `connectors-runtime gate: ${files.length - dirty}/${files.length} ok; verdict=null; clock_started=false\n`
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
    `connectors runtime ${passed} passed, ${failed} failed; verdict=null; clock_started=false; not a 14d verdict\n`
  );
  process.exit(failed ? 1 : 0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`ERROR ${err.message}\n`);
  process.exit(1);
}
