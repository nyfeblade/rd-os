#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible CA2 MCP contract tests.
 *   node contracts/run.js
 * Exit 0. No npm install. Does not arm kill14d. Does not call bin/mcp.js.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { createMcpContract, TOOLS, REJECT_CODES, isMutator } = require(path.join(root, "src", "mcp"));

const catalog = readJson(path.join(__dirname, "tools.json"));
const rejectCatalog = readJson(path.join(__dirname, "reject-codes.json"));
const weightOnly = readJson(path.join(__dirname, "fixtures", "weight-only.json"));
const markdownPacket = readJson(path.join(__dirname, "fixtures", "markdown-packet.json"));
const instrumentPacket = readJson(path.join(__dirname, "fixtures", "instrument-packet.json"));

let failed = 0;
let passed = 0;

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function fail(name, detail) {
  failed += 1;
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
}

function pass(name) {
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function expectReject(name, result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    fail(name, `expected ${code}, got ${JSON.stringify(result)}`);
    return false;
  }
  pass(name);
  return true;
}

function expectOk(name, result) {
  if (!result || result.ok !== true) {
    fail(name, `expected ok, got ${JSON.stringify(result)}`);
    return false;
  }
  pass(name);
  return true;
}

function acquire(mcp, holder, key) {
  return mcp.dispatch("lock.acquire", { holder, idempotency_key: key }, { actor: holder });
}

function main() {
  if (catalog.clock_started !== false) {
    fail("catalog.clock_started", "contracts/tools.json must keep clock_started=false");
  } else {
    pass("catalog.clock_started=false");
  }

  const catalogNames = catalog.tools.map((row) => row.name);
  if (catalogNames.join(" ") !== TOOLS.join(" ")) {
    fail("tools.json", `mismatch ${catalogNames.join(",")} vs ${TOOLS.join(",")}`);
  } else {
    pass("tools.json matches src/mcp TOOLS");
  }

  const families = new Set(TOOLS.map((name) => name.split(".")[0]));
  for (const family of catalog.families) {
    if (!families.has(family)) {
      fail("families", `missing family ${family}`);
    }
  }
  if (families.size === 6) {
    pass("six families present");
  } else {
    fail("families", `expected 6 families, got ${[...families].join(",")}`);
  }

  if (rejectCatalog.codes.join(" ") !== REJECT_CODES.join(" ")) {
    fail("reject-codes.json", "closed set mismatch with src/mcp/reject.js");
  } else {
    pass("reject-codes.json matches src/mcp REJECT_CODES");
  }

  for (const row of catalog.tools) {
    if (Boolean(row.mutator) !== isMutator(row.name)) {
      fail("mutator flag", row.name);
    }
  }
  pass("mutator flags match");

  const mcp = createMcpContract();
  if (mcp.planeKind !== "stub" && mcp.planeKind !== "ca1") {
    fail("planeKind", String(mcp.planeKind));
  } else {
    pass(`plane adapter kind=${mcp.planeKind}`);
  }

  expectReject("UNKNOWN_TOOL", mcp.dispatch("nope.tool", {}), "UNKNOWN_TOOL");

  expectReject(
    "clock_started forbidden",
    mcp.dispatch("board.dump", { clock_started: true }),
    "CLOCK_STARTED_FORBIDDEN"
  );

  expectReject(
    "mutator missing idempotency_key",
    mcp.dispatch("lock.acquire", { holder: "writer" }, { actor: "writer" }),
    "MISSING_IDEMPOTENCY_KEY"
  );

  const firstLock = acquire(mcp, "writer", "acq-1");
  if (!expectOk("lock.acquire writer", firstLock)) {
    finish();
    return;
  }
  const token = firstLock.data.token;
  const replayLock = acquire(mcp, "writer", "acq-1");
  if (!replayLock.ok || replayLock.data.token !== token || replayLock.data.refreshed !== false) {
    fail("idempotent acquire replay", JSON.stringify(replayLock));
  } else {
    pass("idempotent lock.acquire replays same token");
  }

  const conflict = mcp.dispatch(
    "lock.acquire",
    { holder: "other", idempotency_key: "acq-1" },
    { actor: "other" }
  );
  expectReject("idempotency conflict", conflict, "IDEMPOTENCY_CONFLICT");

  const secondHolder = mcp.dispatch(
    "lock.acquire",
    { holder: "intruder", idempotency_key: "acq-intruder" },
    { actor: "intruder" }
  );
  expectReject("LOCK_HELD second writer", secondHolder, "LOCK_HELD");

  const noLockWrite = createMcpContract().dispatch(
    "board.set",
    { experiment_id: "exp-ca2-contract", title: "no lock", idempotency_key: "thesis-nolock" },
    { actor: "writer" }
  );
  expectReject("LOCK_REQUIRED without acquire", noLockWrite, "LOCK_REQUIRED");

  const thesis = mcp.dispatch(
    "board.set",
    {
      experiment_id: "exp-ca2-contract",
      title: "CA2 MCP contract",
      kill: "contract rejects + stub plane; clock unarmed",
      instrument: "node contracts/run.js",
      lock_token: token,
      holder: "writer",
      idempotency_key: "thesis-1",
    },
    { actor: "writer" }
  );
  expectOk("board.set with lock", thesis);

  const week = mcp.dispatch(
    "board.set",
    {
      experiment_id: "exp-ca2-contract",
      title: "two weeks of work",
      lock_token: token,
      holder: "writer",
      idempotency_key: "thesis-week",
    },
    { actor: "writer" }
  );
  expectReject("HUMAN_WEEK_WITHOUT_GATE", week, "HUMAN_WEEK_WITHOUT_GATE");

  const weight = mcp.dispatch("packet.upsert", { ...weightOnly, lock_token: token, holder: "writer" }, { actor: "writer" });
  expectReject("WEIGHT_ONLY plant", weight, "WEIGHT_ONLY");

  const markdown = mcp.dispatch(
    "packet.upsert",
    { ...markdownPacket, lock_token: token, holder: "writer" },
    { actor: "writer" }
  );
  expectReject("NO_RESEARCH markdown", markdown, "NO_RESEARCH");

  const selfCert = mcp.dispatch(
    "packet.upsert",
    { ...instrumentPacket, verdict: "PASS", lock_token: token, holder: "writer", idempotency_key: "pkt-self" },
    { actor: "writer" }
  );
  expectReject("SELF_CERT on upsert", selfCert, "SELF_CERT");

  const packet = mcp.dispatch(
    "packet.upsert",
    { ...instrumentPacket, lock_token: token, holder: "writer" },
    { actor: "writer" }
  );
  expectOk("packet.upsert instrument", packet);

  const packetAgain = mcp.dispatch(
    "packet.upsert",
    { ...instrumentPacket, lock_token: token, holder: "writer" },
    { actor: "writer" }
  );
  if (!packetAgain.ok || packetAgain.data.packet.packet_id !== "pkt-run") {
    fail("idempotent packet.upsert", JSON.stringify(packetAgain));
  } else {
    pass("idempotent packet.upsert");
  }

  const authorSeat = mcp.dispatch(
    "board.assign_seat",
    {
      experiment_id: "exp-ca2-contract",
      seat_actor: "writer",
      role: "author",
      lock_token: token,
      holder: "writer",
      idempotency_key: "seat-author",
    },
    { actor: "writer" }
  );
  const proofSeat = mcp.dispatch(
    "board.assign_seat",
    {
      experiment_id: "exp-ca2-contract",
      seat_actor: "eng-proof",
      role: "proof",
      lock_token: token,
      holder: "writer",
      idempotency_key: "seat-proof",
    },
    { actor: "writer" }
  );
  expectOk("assign author seat", authorSeat);
  expectOk("assign proof seat", proofSeat);

  const badRole = mcp.dispatch(
    "board.assign_seat",
    {
      experiment_id: "exp-ca2-contract",
      seat_actor: "nobody",
      role: "god",
      lock_token: token,
      holder: "writer",
      idempotency_key: "seat-bad",
    },
    { actor: "writer" }
  );
  expectReject("SEAT_FORBIDDEN bad role", badRole, "SEAT_FORBIDDEN");

  const authorVerdict = mcp.dispatch(
    "proof.verdict",
    {
      experiment_id: "exp-ca2-contract",
      packet_id: "pkt-run",
      verdict: "inconclusive",
      actor: "writer",
      lock_token: token,
      holder: "writer",
      idempotency_key: "verdict-author",
    },
    { actor: "writer" }
  );
  expectReject("SEAT_FORBIDDEN author verdict", authorVerdict, "SEAT_FORBIDDEN");

  const clockVerdict = mcp.dispatch(
    "proof.verdict",
    {
      experiment_id: "exp-ca2-contract",
      packet_id: "pkt-run",
      verdict: "inconclusive",
      clock_started: true,
      idempotency_key: "verdict-clock",
    },
    { actor: "eng-proof" }
  );
  expectReject("CLOCK_STARTED_FORBIDDEN on proof", clockVerdict, "CLOCK_STARTED_FORBIDDEN");

  const released = mcp.dispatch(
    "lock.release",
    { holder: "writer", lock_token: token, idempotency_key: "rel-1" },
    { actor: "writer" }
  );
  expectOk("lock.release writer", released);

  const proofLock = acquire(mcp, "eng-proof", "acq-proof");
  if (!expectOk("lock.acquire proof", proofLock)) {
    finish();
    return;
  }
  const asProof = mcp.dispatch(
    "proof.verdict",
    {
      experiment_id: "exp-ca2-contract",
      packet_id: "pkt-run",
      verdict: "inconclusive",
      actor: "eng-proof",
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "verdict-proof",
    },
    { actor: "eng-proof" }
  );
  if (!asProof.ok || asProof.data.packet.verdict !== "inconclusive") {
    fail("proof.verdict as proof seat", JSON.stringify(asProof));
  } else {
    pass("proof.verdict as proof seat");
  }

  const agentGate = mcp.dispatch(
    "gate.add",
    { experiment_id: "exp-ca2-contract", kind: "merge", reason: "agent must fail", idempotency_key: "gate-agent" },
    { actor: "agent" }
  );
  expectReject("NOT_HUMAN gate.add", agentGate, "NOT_HUMAN");

  const badKind = mcp.dispatch(
    "gate.add",
    { experiment_id: "exp-ca2-contract", kind: "vibes", reason: "no", idempotency_key: "gate-bad" },
    { actor: "human" }
  );
  expectReject("GATE_UNKNOWN_KIND", badKind, "GATE_UNKNOWN_KIND");

  const humanGate = mcp.dispatch(
    "gate.add",
    { experiment_id: "exp-ca2-contract", kind: "quota_unfreeze", reason: "quota-blocked", idempotency_key: "gate-1" },
    { actor: "human" }
  );
  expectOk("gate.add human", humanGate);

  const gateReplay = mcp.dispatch(
    "gate.add",
    { experiment_id: "exp-ca2-contract", kind: "quota_unfreeze", reason: "quota-blocked", idempotency_key: "gate-1" },
    { actor: "human" }
  );
  if (!gateReplay.ok) {
    fail("idempotent gate.add", JSON.stringify(gateReplay));
  } else {
    pass("idempotent gate.add");
  }

  const resolveMissing = mcp.dispatch(
    "gate.resolve",
    { experiment_id: "exp-ca2-contract", kind: "merge", idempotency_key: "gate-miss" },
    { actor: "human" }
  );
  expectReject("NOT_FOUND gate.resolve", resolveMissing, "NOT_FOUND");

  const resolved = mcp.dispatch(
    "gate.resolve",
    { experiment_id: "exp-ca2-contract", kind: "quota_unfreeze", reason: "cleared", idempotency_key: "gate-res" },
    { actor: "human" }
  );
  expectOk("gate.resolve human", resolved);

  const budget = mcp.dispatch(
    "budget.set",
    {
      experiment_id: "exp-ca2-contract",
      ca_hours_budget: 1,
      proof_min_budget: 10,
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "bud-1",
    },
    { actor: "eng-proof" }
  );
  expectOk("budget.set", budget);

  const spendOk = mcp.dispatch(
    "budget.spend",
    {
      experiment_id: "exp-ca2-contract",
      ca_hours: 0.4,
      proof_min: 2,
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "spend-1",
    },
    { actor: "eng-proof" }
  );
  expectOk("budget.spend under cap", spendOk);

  const exhausted = mcp.dispatch(
    "budget.spend",
    {
      experiment_id: "exp-ca2-contract",
      ca_hours: 0.8,
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "spend-ex",
    },
    { actor: "eng-proof" }
  );
  expectReject("RESOURCE_EXHAUSTED", exhausted, "RESOURCE_EXHAUSTED");

  const exhaustedRetry = mcp.dispatch(
    "budget.spend",
    {
      experiment_id: "exp-ca2-contract",
      ca_hours: 0.8,
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "spend-ex",
    },
    { actor: "eng-proof" }
  );
  expectReject("RESOURCE_EXHAUSTED replay", exhaustedRetry, "RESOURCE_EXHAUSTED");

  const exhaustedNewKey = mcp.dispatch(
    "budget.spend",
    {
      experiment_id: "exp-ca2-contract",
      ca_hours: 0.8,
      lock_token: proofLock.data.token,
      holder: "eng-proof",
      idempotency_key: "spend-ex-2",
    },
    { actor: "eng-proof" }
  );
  expectReject("RESOURCE_EXHAUSTED new key still STOP", exhaustedNewKey, "RESOURCE_EXHAUSTED");

  const dropFields = mcp.dispatch(
    "budget.spend",
    { experiment_id: "exp-ca2-contract", idempotency_key: "spend-drop" },
    { actor: "eng-proof" }
  );
  expectReject("spend dropped fields is not a bypass", dropFields, "MISSING_FIELD");

  const dump = mcp.dispatch("board.dump", {});
  if (
    !dump.ok ||
    !dump.data.thesis ||
    dump.data.thesis.status !== "ACTIVE" ||
    !Array.isArray(dump.data.packets) ||
    dump.data.packets.length < 1
  ) {
    fail("board.dump", JSON.stringify(dump));
  } else {
    pass("board.dump has ACTIVE thesis + packet");
  }

  const listed = mcp.listTools().map((tool) => tool.name);
  if (listed.join(" ") !== TOOLS.join(" ")) {
    fail("listTools", listed.join(","));
  } else {
    pass("listTools names");
  }

  finish();
}

function finish() {
  process.stdout.write(
    `CA2 contract tests ${passed} passed, ${failed} failed; clock_started=false; not a 14d verdict\n`
  );
  process.exit(failed ? 1 : 0);
}

main();
