#!/usr/bin/env node
"use strict";

/**
 * Prove Mac cold-open is wired to auth + seats + HITL.
 * Exit 2 if Connect GitHub is still a local status flip or Board is fixture-only.
 *
 *   cd studio/shell && npm test
 *   node scripts/prove-live.js
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createStudioLive, githubTrayStatus, AUTH_REL, SEATS_REL, HITL_REL } = require("../lib/studio-live");
const { createPreviewServer } = require("./preview");

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

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sourceFences() {
  const app = read("renderer/app.js");
  const mainJs = read("electron/main.js");
  const preload = read("electron/preload.js");
  const preview = read("scripts/preview.js");
  const live = read("lib/studio-live.js");
  const board = read("renderer/panes/board-pane.js");
  const html = read("renderer/index.html");
  const tray = read("renderer/chrome/connectors-tray.js");

  if (!live.includes("createAuth") || !live.includes("createStudioSeats") || !live.includes("createHitlKernel")) {
    fail("live-modules", "studio-live must require auth, seats, and hitl kernels");
  }
  if (!mainJs.includes("createStudioLive") || !mainJs.includes("studio:auth.start") || !mainJs.includes("studio:seats.connect")) {
    fail("main", "Electron main must expose auth.start and seats.connect");
  }
  if (!mainJs.includes("trafficLightPosition") || !mainJs.includes("hiddenInset")) {
    fail("mac-lights", "Electron main must set hiddenInset + trafficLightPosition");
  }
  if (!preload.includes("studio:auth.start") || !preload.includes("studio:seats.connect") || !preload.includes("studio:hitl.resolve")) {
    fail("preload", "preload must expose auth, seats, and hitl");
  }
  if (!preview.includes("/auth/start") || !preview.includes("/seats/connect") || !preview.includes("/hitl/create")) {
    fail("preview", "preview must expose auth/seats/hitl routes");
  }
  if (preview.includes("demoInbox()")) {
    fail("preview-inbox", "preview inbox must not call demoInbox()");
  }
  if (mainJs.includes("demoInbox()")) {
    fail("main-inbox", "Electron inbox must not call demoInbox()");
  }
  if (!app.includes("auth.start") || !app.includes("seats.connect")) {
    fail("renderer-cta", "Connect CTAs must call auth.start and seats.connect");
  }
  if (/connector\.status\s*=\s*"live"/.test(app) || /next\.status\s*=\s*"live"/.test(app)) {
    fail("fake-live", "Connect GitHub must not flip local connector.status to live");
  }
  if (app.includes("applyLiveDemo")) {
    fail("demo", "applyLiveDemo fake-live path must be gone");
  }
  if (app.includes("approved locally (stub)")) {
    fail("hitl-stub", "Board must not resolve HITL locally as a stub");
  }
  if (app.includes("Deploy to production (Vercel)") || app.includes("pendingHitl")) {
    fail("planted-hitl", "planted pendingHitl fixture must be gone");
  }
  if (html.includes("id=\"view-live\"") && !html.includes("id=\"view-switcher\" hidden")) {
    fail("demo-switcher", "demo view switcher must stay hidden — not product chrome");
  }
  if (!html.includes("id=\"cta-github\"") || !html.includes("id=\"cta-import\">Import team<")) {
    fail("cta", "cold-open must keep GitHub + Import team");
  }
  if (!html.includes("id=\"cta-seat\"") || !html.includes("id=\"cta-seat\" hidden") || html.includes("id=\"cta-seat\">Seat<")) {
    fail("cta-seat", "hidden #cta-seat must be labeled Connect — not Seat");
  }
  if (!html.includes("aria-label=\"Team\"") || html.includes("id=\"seat-list\" hidden")) {
    fail("team-rail", "Team rail must be visible (not hidden seat-list)");
  }
  if (!board.includes("state.gates") || !board.includes("need_you")) {
    fail("board", "Board must render kernel need_you rows");
  }
  if (board.includes("waiting_on === \"human\"") || board.includes("attention.human")) {
    fail("board-fixture", "Board HITL must not be attention.*.json fixtures");
  }
  if (tray.includes("state.view === \"cold\"")) {
    fail("tray-cold", "tray must not hide needs_auth on first open");
  }
  if (!app.includes("githubConnected") || !app.includes("needs_auth")) {
    fail("session-gate", "GitHub live must be gated on a real session");
  }
  if (app.includes("XAI_API_KEY") || app.includes("set XAI") || app.includes("MISSING_SECRET")) {
    fail("key-toast", "Connect must not toast set XAI_API_KEY / MISSING_SECRET as the happy path");
  }
  const bridge = read("lib/seats-bridge.js");
  const connectStart = bridge.indexOf("function connect(");
  const listStart = bridge.indexOf("function list(");
  const connectBody = connectStart >= 0 && listStart > connectStart
    ? bridge.slice(connectStart, listStart)
    : "";
  if (!connectBody || connectBody.includes("missingSecret") || connectBody.includes("MISSING_SECRET") || connectBody.includes("API_KEY")) {
    fail("key-gate", "Connect happy path must not require a provider API key");
  }
  if (!bridge.includes("mcp_attach") || !bridge.includes("studio/mcp")) {
    fail("mcp-attach", "Connect must return mcp_attach: studio/mcp");
  }
  pass("source fence: auth+seats+HITL required; demo theater killed; no API-key Connect");
}

async function kernelProve() {
  const home = tmpDir("studio-shell-live-");
  const live = createStudioLive({
    varDir: home,
    platform: "linux",
    env: { SUPABASE_ANON_KEY: "" },
  });

  const snap = live.snapshot();
  if (snap.modules.auth !== AUTH_REL || snap.modules.seats !== SEATS_REL || snap.modules.hitl !== HITL_REL) {
    fail("modules", `expected kernel marks, got ${JSON.stringify(snap.modules)}`);
  }
  if (githubTrayStatus(snap.auth.session) !== "needs_auth") {
    fail("github-status", "no session must stay needs_auth");
  }
  const github = snap.connectors.find((row) => row.id === "github");
  if (!github || github.status === "live") {
    fail("github-live", "GitHub must not be live without a session");
  }
  if (snap.inbox.length !== 0) {
    fail("inbox-cold", "inbox must be empty without a GitHub session");
  }
  if (snap.in_studio === true) {
    fail("cutover-cold", "no bot should be attached on cold open");
  }
  pass("cold snapshot: needs_auth, empty inbox, no fake live");

  const started = live.startOAuth();
  if (started.ok) {
    fail("auth-key", "empty SUPABASE_ANON_KEY must reject startOAuth");
  }
  if (started.code !== "MISSING_ANON_KEY") {
    fail("auth-code", `expected MISSING_ANON_KEY, got ${started.code}`);
  }
  if (githubTrayStatus(started.state.auth.session) === "live") {
    fail("auth-fake-live", "failed OAuth must not mark GitHub live");
  }
  pass("Connect GitHub calls studio/auth (MISSING_ANON_KEY, not local live)");

  const connected = live.connectSeat("cursor");
  if (!connected.ok) {
    fail("seats-connect", `${connected.code}: ${connected.detail}`);
  }
  if (connected.code === "MISSING_SECRET") {
    fail("key-gate-runtime", "Connect must not require a provider API key");
  }
  if (connected.mcp_attach !== "studio/mcp") {
    fail("mcp-attach-runtime", `expected mcp_attach studio/mcp, got ${connected.mcp_attach}`);
  }
  if (!connected.in_studio_only || !connected.connection || connected.connection.cutover !== true) {
    fail("seats-cutover", "connect(cursor) must attach in-studio");
  }
  const grok = live.connectSeat("grok");
  if (!grok.ok || grok.code === "MISSING_SECRET") {
    fail("no-key-grok", `Connect grok must attach without XAI_API_KEY, got ${JSON.stringify({ ok: grok.ok, code: grok.code, detail: grok.detail })}`);
  }
  const elon = live.connectSeat("elon");
  if (!elon.ok || elon.provider !== "grok") {
    fail("elon-alias", `elon must resolve to grok without a key, got ${JSON.stringify({ ok: elon.ok, provider: elon.provider, code: elon.code })}`);
  }
  const cursor = connected.state.seats.find((seat) => seat.id === "cursor");
  if (!cursor || cursor.presence !== "online" || cursor.cutover !== true) {
    fail("seats-dump", `expected cursor online+cutover from dump, got ${JSON.stringify(cursor)}`);
  }
  if (connected.state.in_studio !== true) {
    fail("in-studio-chip", "attached bot must set in_studio from seats.dump");
  }
  pass("Add seat calls seats.connect(cursor) → presence/cutover from dump");

  const created = live.createGate({
    kind: "merge",
    title: "Merge gate · shell live",
    payload_summary: "merge after seats.connect",
  });
  if (!created.ok) {
    fail("hitl-create", `${created.code}: ${created.detail}`);
  }
  if (!created.gate.need_you || created.gate.status !== "open") {
    fail("hitl-open", `expected open need_you gate, got ${JSON.stringify(created.gate)}`);
  }
  const listed = live.listNeedYou();
  if (!listed.ok || !listed.gates.some((gate) => gate.id === created.gate.id)) {
    fail("hitl-list", "listNeedYou missing the created gate");
  }
  const approved = live.resolveGate({ id: created.gate.id, decision: "approve", actor: "human" });
  if (!approved.ok || approved.gate.status !== "approved" || approved.gate.need_you !== false) {
    fail("hitl-resolve", `expected kernel approve, got ${JSON.stringify(approved)}`);
  }
  pass("Board HITL is createHitlKernel create/list/resolve — not a fixture stub");

  live.close();
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
    server.on("error", reject);
  });
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method,
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(new Error(`${urlPath} not JSON: ${text.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function previewSmoke() {
  const home = tmpDir("studio-shell-preview-");
  const { server, ctx } = createPreviewServer({
    varDir: home,
    platform: "linux",
    skipBind: true,
    env: { SUPABASE_ANON_KEY: "" },
  });
  const port = await listen(server);
  try {
    const cold = await request(port, "GET", "/live/state");
    if (!cold.ok) {
      fail("preview-state", "GET /live/state failed");
    }
    const github = cold.connectors.find((row) => row.id === "github");
    if (!github || github.status === "live") {
      fail("preview-github", "preview GitHub was live without a session");
    }
    const started = await request(port, "POST", "/auth/start", {});
    if (started.ok || started.code !== "MISSING_ANON_KEY") {
      fail("preview-auth", `expected MISSING_ANON_KEY, got ${JSON.stringify(started)}`);
    }
    const afterAuth = await request(port, "GET", "/auth/session");
    if (afterAuth.session) {
      fail("preview-session", "auth.start without a key must not create a session");
    }
    const connected = await request(port, "POST", "/seats/connect", { provider: "claude" });
    if (!connected.ok || connected.code === "MISSING_SECRET" || !connected.in_studio_only) {
      fail("preview-seat", `seats.connect must attach without API keys: ${JSON.stringify(connected)}`);
    }
    if (connected.mcp_attach !== "studio/mcp") {
      fail("preview-mcp-attach", `expected mcp_attach studio/mcp, got ${JSON.stringify(connected)}`);
    }
    const dump = await request(port, "GET", "/seats/dump");
    if (!dump.seats.some((seat) => seat.id === "claude" && seat.cutover === true)) {
      fail("preview-dump", "dump missing attached claude");
    }
    const inbox = await request(port, "GET", "/twoway/inbox.json");
    if (!Array.isArray(inbox) || inbox.length !== 0) {
      fail("preview-inbox", "inbox must stay empty without GitHub session (not demoInbox)");
    }
    const gate = await request(port, "POST", "/hitl/create", {
      kind: "deploy",
      title: "Deploy after connect",
      payload_summary: "preview smoke kernel gate",
    });
    if (!gate.ok || !gate.gate.need_you) {
      fail("preview-gate", `createGate failed: ${JSON.stringify(gate)}`);
    }
    const needYou = await request(port, "GET", "/hitl/need-you");
    if (!needYou.gates.some((row) => row.id === gate.gate.id)) {
      fail("preview-need-you", "listNeedYou missing preview gate");
    }
    const resolved = await request(port, "POST", "/hitl/resolve", {
      id: gate.gate.id,
      decision: "reject",
      actor: "human",
    });
    if (!resolved.ok || resolved.gate.status !== "rejected") {
      fail("preview-resolve", `resolveGate failed: ${JSON.stringify(resolved)}`);
    }
    const market = await request(port, "GET", "/market/browse");
    if (!market.ok || !market.data || !market.data.entries.some((row) => row.id === "studio-mcp")) {
      fail("preview-market", "marketplace must surface studio-mcp");
    }
    const modes = await request(port, "GET", "/modes");
    if (!modes.ok || !modes.data || !modes.data.modes.some((row) => row.id === "eng-coding")) {
      fail("preview-modes", "modes registry must be surfaced");
    }
    const mcp = await request(port, "GET", "/mcp/surface");
    if (!mcp.ok || !Array.isArray(mcp.tools) || mcp.tools.length < 1) {
      fail("preview-mcp", "MCP surface missing tools");
    }
    pass("preview smoke: auth rejects without key, seats.connect attaches, HITL kernel resolves");
  } finally {
    ctx.live.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  sourceFences();
  await kernelProve();
  await previewSmoke();
  assert.equal(githubTrayStatus(null), "needs_auth");
  assert.equal(githubTrayStatus({ user: { login: "x" } }), "live");
  process.stdout.write("studio/shell prove-live ok\n");
}

main().catch((err) => {
  fail("prove-live", err && err.stack ? err.stack : String(err));
});
