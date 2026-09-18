#!/usr/bin/env node
"use strict";

/**
 * Prove Add seat → pick provider → Connect is bound to studio/seats.
 * Exit 2 if the handler is a no-op or still renderer-local theater.
 *
 *   cd studio/shell && npm test
 *   node scripts/prove-seat-connect.js
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CONNECT_ACK,
  KNOWN_PROVIDERS,
  SEATS_REL,
  createSeatsSession,
  missingSecret,
  secretKeysFor,
} = require("../lib/seats-bridge");
const { openAddSeat, pickProvider, runSeatConnectClick } = require("../lib/seat-connect");
const ui = require("../renderer/seat-connect.js");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(name, detail) {
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
  process.exit(2);
}

function pass(name) {
  process.stdout.write(`ok  ${name}\n`);
}

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-shell-seats-"));
}

function emptyEnv() {
  return {};
}

function envFor(provider) {
  const env = {};
  for (const key of secretKeysFor(provider)) {
    env[key] = `prove-${provider}-${key.toLowerCase()}`;
  }
  return env;
}

function sourceFence() {
  const app = read("renderer/app.js");
  const mainJs = read("electron/main.js");
  const preload = read("electron/preload.js");
  const preview = read("scripts/preview.js");
  const html = read("renderer/index.html");
  const presence = read("renderer/chrome/presence-bar.js");
  const pkg = read("package.json");
  const readme = read("README.md");

  if (!mainJs.includes("createSeatsSession") || !mainJs.includes("studio:seats.connect")) {
    fail("main", "Electron main must create a seats session and handle studio:seats.connect");
  }
  if (!preload.includes("studio:seats.connect") || !preload.includes("seats:")) {
    fail("preload", "preload must expose seats.connect");
  }
  if (!preview.includes("/seats/connect") || !preview.includes("runSeatConnectClick")) {
    fail("preview", "preview must expose /seats/connect through runSeatConnectClick");
  }
  if (!app.includes("seatsInvoke") || !app.includes('seatsInvoke("connect"')) {
    fail("renderer", "Connect must call seatsInvoke(\"connect\") — not a local flip");
  }
  if (!app.includes("openAddSeat") || !app.includes("showSeatError")) {
    fail("renderer", "Add seat must open a picker and showSeatError on failure");
  }
  if (/seat\.presence\s*=\s*"online"/.test(app) && !app.includes("applySeatConnect")) {
    fail("renderer", "local presence flip without applySeatConnect is demo theater");
  }
  if (!html.includes("id=\"seat-providers\"") || !html.includes("id=\"shell-toast\"")) {
    fail("html", "sheet must expose provider picker + visible toast");
  }
  if (!html.includes("id=\"cutover-error\"")) {
    fail("html", "missing visible cutover error node");
  }
  if (!html.includes("id=\"cta-seat\"") || !html.includes("id=\"cutover-confirm\"")) {
    fail("html", "Add seat / Connect buttons missing");
  }
  if (!presence.includes("in-studio-only") || !presence.includes("shouldShowPresence")) {
    fail("presence", "presence must show connected seats as online + in-studio-only");
  }
  if (!pkg.includes("prove-seat-connect.js")) {
    fail("package", "npm test must run prove-seat-connect");
  }
  if (!readme.includes("prove-seat-connect") || !readme.includes("studio/seats")) {
    fail("readme", "README must document seats connect + prove");
  }
  if (app.includes("function confirmCutover") && /connector\.status = \"live\"/.test(app) && !app.includes("isKnownProvider")) {
    fail("renderer", "Connect still treats seat providers as tray theater");
  }
  pass("source fence: Add seat + Connect bound to studio/seats");
}

function proveClickPath() {
  const opened = runSeatConnectClick({ phase: "open" });
  if (!opened.ok || opened.phase !== "open" || opened.pick !== true) {
    fail("open", `Add seat must open a picker, got ${JSON.stringify(opened)}`);
  }
  if (!Array.isArray(opened.providers) || opened.providers.length !== 6) {
    fail("open providers", `expected 6 providers, got ${JSON.stringify(opened.providers)}`);
  }
  const ids = opened.providers.map((row) => row.id).slice().sort();
  if (ids.join(",") !== KNOWN_PROVIDERS.slice().sort().join(",")) {
    fail("open providers", `expected ${KNOWN_PROVIDERS.join(",")}, got ${ids.join(",")}`);
  }
  if (opened.copy !== CONNECT_ACK) {
    fail("open ack", `expected CONNECT_ACK, got ${opened.copy}`);
  }
  pass("Add seat opens picker for claude, grok, cursor, codex, gemini, chatgpt");

  const bare = runSeatConnectClick({
    home: tmpHome(),
    env: emptyEnv(),
    provider: null,
  });
  if (bare.ok || bare.code !== "BAD_ARGUMENT" || bare.visible_error !== true) {
    fail("connect no pick", `expected visible BAD_ARGUMENT, got ${JSON.stringify(bare)}`);
  }
  pass("Connect without a provider is a visible error, not a no-op");

  const unknown = runSeatConnectClick({
    home: tmpHome(),
    env: emptyEnv(),
    provider: "luke",
  });
  if (unknown.ok || unknown.code !== "UNKNOWN_PROVIDER" || unknown.visible_error !== true) {
    fail("unknown", `expected visible UNKNOWN_PROVIDER, got ${JSON.stringify(unknown)}`);
  }
  pass("unknown provider is a visible error");

  const missing = runSeatConnectClick({
    home: tmpHome(),
    env: emptyEnv(),
    provider: "grok",
  });
  if (missing.ok || missing.code !== "MISSING_SECRET" || missing.visible_error !== true) {
    fail("missing secret", `expected visible MISSING_SECRET, got ${JSON.stringify(missing)}`);
  }
  if (!/XAI_API_KEY/.test(missing.detail || "")) {
    fail("missing secret copy", `error must name the secret, got ${missing.detail}`);
  }
  if (missing.mutated === true) {
    fail("missing secret", "seats state must not mutate when auth is missing");
  }
  pass("missing XAI_API_KEY is a visible MISSING_SECRET");

  for (const provider of KNOWN_PROVIDERS) {
    const denied = missingSecret(provider, emptyEnv());
    if (!denied || denied.code !== "MISSING_SECRET") {
      fail(`${provider} secret`, `expected MISSING_SECRET, got ${JSON.stringify(denied)}`);
    }
  }
  pass("every known provider fail-closes without secrets");
}

function proveMutatesSeats() {
  for (const provider of KNOWN_PROVIDERS) {
    const home = tmpHome();
    const session = createSeatsSession({ home, env: envFor(provider) });
    const result = runSeatConnectClick({
      session,
      provider,
    });
    if (!result.ok) {
      fail(`connect ${provider}`, `${result.code}: ${result.detail}`);
    }
    if (result.engine !== SEATS_REL) {
      fail(`connect ${provider} engine`, `expected ${SEATS_REL}, got ${result.engine}`);
    }
    if (!result.seat || result.seat.presence !== "online" || result.seat.in_studio_only !== true) {
      fail(`connect ${provider} seat`, `expected online + in_studio_only, got ${JSON.stringify(result.seat)}`);
    }
    if (result.cutover !== true || result.in_studio_only !== true) {
      fail(`connect ${provider} cutover`, JSON.stringify(result));
    }
    if (!result.presence || result.presence.state !== "online" || result.presence.in_studio_only !== true) {
      fail(`connect ${provider} presence`, JSON.stringify(result.presence));
    }

    const listed = session.presence();
    if (!listed.ok) {
      fail(`presence ${provider}`, `${listed.code}: ${listed.detail}`);
    }
    const row = listed.presence.find((item) => item.id === provider);
    if (!row || row.state !== "online" || row.in_studio_only !== true) {
      fail(`presence persist ${provider}`, JSON.stringify(listed));
    }

    const reopened = createSeatsSession({ home, env: envFor(provider) });
    const again = reopened.presence();
    const persisted = again.ok && again.presence.find((item) => item.id === provider);
    if (!persisted || persisted.state !== "online" || persisted.in_studio_only !== true) {
      fail(`reopen ${provider}`, "connect did not persist seats state — still theater");
    }
  }
  pass("Connect mutates studio/seats: online + in_studio_only for all 6 providers");
}

function proveHandlerNotNoop() {
  const noop = function confirmCutover() {
    return undefined;
  };
  const result = noop();
  if (result !== undefined) {
    fail("control", "control no-op unexpectedly returned a value");
  }

  const live = runSeatConnectClick({
    home: tmpHome(),
    env: envFor("claude"),
    provider: "claude",
  });
  if (live == null || live.ok !== true || live.mutated !== true) {
    fail("handler", "connect click path returned a no-op");
  }

  const opened = openAddSeat();
  const picked = pickProvider("cursor");
  if (!opened.ok || !picked.ok || picked.id !== "cursor") {
    fail("picker", "Add seat / pick provider handlers no-op");
  }
  pass("connect click path is not a no-op");
}

function proveUiApply() {
  if (!ui || typeof ui.applyConnectResult !== "function") {
    fail("ui", "renderer/seat-connect.js must export applyConnectResult");
  }
  const cold = [
    { id: "human", name: "You", kind: "human", presence: "online", cutover: true },
    { id: "grok", name: "Grok", kind: "bot", presence: "offline", cutover: false },
    { id: "room:chat", name: "Agents", kind: "room", presence: "offline", cutover: false },
  ];
  const failed = ui.applyConnectResult(cold, { ok: false, code: "MISSING_SECRET", detail: "XAI_API_KEY is missing" });
  if (failed.ok || failed.detail.indexOf("XAI_API_KEY") === -1) {
    fail("ui error", JSON.stringify(failed));
  }
  const silent = ui.applyConnectResult(cold, undefined);
  if (silent.ok || silent.code !== "NO_OP") {
    fail("ui no-op", "missing result must surface NO_OP, not apply");
  }
  const applied = ui.applyConnectResult(cold, {
    ok: true,
    seat: {
      id: "grok",
      name: "Grok",
      kind: "bot",
      presence: "online",
      cutover: true,
      in_studio_only: true,
    },
  });
  if (!applied.ok || applied.seat.presence !== "online" || applied.seat.in_studio_only !== true) {
    fail("ui apply", JSON.stringify(applied));
  }
  const gemini = ui.applyConnectResult(cold, {
    ok: true,
    seat: {
      id: "gemini",
      name: "Gemini",
      kind: "bot",
      presence: "online",
      cutover: true,
      in_studio_only: true,
    },
  });
  if (!gemini.ok || !gemini.seats.some((seat) => seat.id === "gemini" && seat.in_studio_only)) {
    fail("ui register", "new provider must land on the roster");
  }
  pass("renderer apply mutates seats or returns a visible error");
}

function main() {
  sourceFence();
  proveClickPath();
  proveMutatesSeats();
  proveHandlerNotNoop();
  proveUiApply();
  assert.equal(KNOWN_PROVIDERS.length, 6);
  process.stdout.write("studio/shell prove-seat-connect ok\n");
}

main();
