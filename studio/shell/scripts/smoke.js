"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const { CATALOG_REL, catalogPath, catalogPresent, tryReadCatalogP0, tryReadTwoWayWire } = require("../lib/read-catalog");
const twoWay = require("../lib/two-way");
const { INGRESS_REL, ingressPresent, tryLoadIngress } = require("../lib/read-ingress");
const { coldOpenSeats, CONNECT_ACK, DEFAULT_SEAT_IDS, IN_STUDIO_ONLY_LABEL } = require("../lib/cold-open");
const seats = require("../../seats");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const html = read("renderer/index.html");
const css = read("renderer/styles.css");
const tokens = read("renderer/tokens.css");
const js = read("renderer/app.js");
const chat = read("renderer/panes/chat-pane.js");
const board = read("renderer/panes/board-pane.js");
const code = read("renderer/panes/code-drawer.js");
const tray = read("renderer/chrome/connectors-tray.js");
const modes = read("renderer/chrome/modes-rail.js");
const presence = read("renderer/chrome/presence-bar.js");
const main = read("electron/main.js");
const readme = read("README.md");

for (const pane of ["chat", "code", "board"]) {
  assert.match(html, new RegExp(`data-pane="${pane}"`), `missing ${pane} pane`);
}

assert.match(html, /id="mode-chip"/);
assert.match(html, /data-chrome="modes-rail"/);
assert.match(html, /data-chrome="connectors-tray"/);
assert.match(html, /data-chrome="presence-bar"/);
assert.match(html, /data-module="chat-pane"/);
assert.match(html, /data-module="board-pane"/);
assert.match(html, /data-module="code-drawer"/);
assert.match(html, /id="watches"/);
assert.match(html, /id="btn-code"/);
assert.match(html, /id="hint-code"/);
assert.match(html, /id="btn-close"/);
assert.match(html, /id="connectors-tray"/);
assert.match(html, /id="instruments"/);
assert.match(html, /id="presence-btn"/);
assert.match(html, /id="cutover-sheet"/);
assert.match(html, /This seat works in Studio only while connected/);
assert.match(html, /Connect GitHub and an agent/);
assert.match(html, /placeholder="Message/);
assert.match(html, /id="view-cold"/);
assert.match(html, /first open/);
assert.match(html, /id="chat-cold"/);
assert.match(html, /id="cta-github"/);
assert.match(html, /id="with"/);
assert.match(html, /id="seat-list" hidden/);
assert.match(html, /id="instruments" hidden/);
assert.match(html, /id="watches" hidden/);
assert.match(html, /id="mode-chip"/);
assert.match(html, /class="compose"/);
assert.match(html, /id="inbox-ctx"/);
assert.match(html, /id="compose-hint"/);
assert.match(html, /Reply composer/);
assert.match(html, /class="tray"/);
assert.match(html, /id="thread-meter"/);
assert.match(html, /id="board-meter"/);
assert.match(html, /token-meter\.js/);
assert.match(html, /data-chrome="modes-rail"/);
assert.match(html, /your-repo/);
assert.match(html, /code-pane/);
assert.match(html, /hidden/);
assert.match(html, /chrome\/connectors-tray\.js/);
assert.match(html, /panes\/code-drawer\.js/);
assert.doesNotMatch(html, /data-nav="waiting"/);
assert.doesNotMatch(html, /Waiting · Experiments · History/);
assert.doesNotMatch(html, /class="main code-open"/);
assert.doesNotMatch(html, /Eng Lead/);
assert.doesNotMatch(html, /nyfeblade\/rd-os/);

assert.match(css, /\.code-pane\s*\{\s*display:\s*none/);
assert.match(css, /\.main\.code-open \.code-pane/);
assert.match(css, /grid-template-columns:\s*1fr 280px/);
assert.match(css, /grid-template-columns:\s*1fr 340px 260px/);
assert.match(css, /\.warn/);
assert.match(css, /\.tray button\.live/);
assert.match(css, /\.tray button\.auth/);
assert.match(css, /\.tray button\.error/);
assert.match(css, /font-weight:\s*600/);
assert.match(css, /\.gate/);
assert.match(css, /\.quiet/);
assert.match(css, /\.switcher/);
assert.match(css, /\.empty h1/);
assert.doesNotMatch(css, /minmax\(280px,\s*1\.05fr\).*minmax\(360px/);
assert.doesNotMatch(css, /#c4b5fd|#7c3aed|#8b5cf6/);
assert.doesNotMatch(css, /box-shadow:\s*0 0 \d+px/);
assert.doesNotMatch(css, /\.pill\b/);
assert.doesNotMatch(css, /border-radius:\s*999/);

assert.match(js, /codeOpen:\s*false/);
assert.match(js, /setCodeOpen\(els, state, false\)/);
assert.match(js, /attention\.empty\.json/);
assert.match(js, /attention\.(human|dump)/);
assert.match(js, /loadCatalog/);
assert.match(js, /FALLBACK_P0/);
assert.match(js, /mode: "eng"/);
assert.match(js, /view: "cold"/);
assert.match(js, /setView/);
assert.match(js, /applyLiveDemo/);
assert.match(js, /needs_auth/);
assert.match(js, /loadInbox/);
assert.match(js, /inboxFilter/);
assert.match(js, /bound_to/);
assert.match(js, /actor: "bot"/);
assert.match(js, /actor: "human"/);
assert.match(js, /id: "slack"/);
assert.match(js, /Bot Slack reply \(cutover\)/);
assert.match(js, /tokens:/);
assert.match(js, /session: null/);
assert.match(js, /Escape/);
assert.doesNotMatch(js, /Eng Lead/);
assert.doesNotMatch(js, /nyfeblade\/rd-os/);
assert.doesNotMatch(js, /integrate/);

assert.match(chat, /id: "human"/);
assert.match(chat, /id: "grok"/);
assert.match(chat, /id: "claude"/);
assert.match(chat, /id: "cursor"/);
assert.match(chat, /room:chat/);
assert.match(chat, /Talk to agents/);
assert.match(chat, /in-studio-only/);
assert.match(chat, /seatList.hidden = true/);
assert.match(chat, /bound_to|boundTo|boundItem/);
assert.match(chat, /GitHub → inbox|inbox/);
assert.match(chat, /inboxFilter/);
assert.match(chat, /replyKindFor/);
assert.match(chat, /case "dm"/);
assert.match(chat, /handlers.bindInbox/);
assert.match(chat, /You \(draft out\)/);
assert.match(chat, /Slack needs sign-in in tray/);
assert.doesNotMatch(chat, /person on/);
assert.doesNotMatch(chat, /Eng Lead/);

assert.match(board, /Needs you/);
assert.match(board, /also from inbox/);
assert.match(board, /ci_failure/);
assert.match(board, /Allow send/);
assert.match(board, /Human gate before bot sends out/);
assert.match(board, /instrumentFor/);
assert.match(board, /Agent map/);
assert.match(board, /View diff/);
assert.match(board, /hideUntilNeeded/);
assert.doesNotMatch(board, /bc-7c385702/);
assert.doesNotMatch(board, /className = extraClass \? `card/);
assert.doesNotMatch(board, /nyfeblade\/rd-os/);
assert.doesNotMatch(board, /PR#11/);

assert.match(code, /setCodeOpen/);
assert.match(tray, /problemConnectors/);
assert.match(tray, /p0TrayRows/);
assert.match(tray, /inboxEntry/);
assert.match(tray, /P0_UX/);
assert.match(tray, /needs sign-in/);
assert.match(tray, /state.view === "cold"/);
assert.match(tray, /case "live"/);
assert.match(tray, /case "needs_auth"/);
assert.match(tray, /case "error"/);
assert.match(tray, /case "disconnected"/);
assert.doesNotMatch(tray, /iconGlyph/);
assert.doesNotMatch(tray, /for \(const connector of state.connectors\)/);
assert.match(modes, /nextMode/);
assert.match(modes, /case "eng"/);
assert.match(modes, /case "design"/);
assert.match(modes, /modeChip.hidden = true/);
assert.doesNotMatch(modes, /review/);
assert.match(presence, /presenceBtn.hidden = true/);

assert.match(tokens, /--bg:\s*#fff/);
assert.match(tokens, /--accent:\s*#111/);
assert.match(tokens, /--ink:\s*#111/);
assert.match(tokens, /--line:\s*#e8e8e8/);
assert.doesNotMatch(tokens, /#0c0c0e|#c4b5fd|#141416/);

assert.match(main, /DEFAULT_WIDTH = 1440/);
assert.match(main, /DEFAULT_HEIGHT = 900/);
assert.match(main, /MIN_WIDTH = 1200/);
assert.match(main, /MIN_HEIGHT = 720/);
assert.match(main, /tryReadCatalogP0/);
assert.match(main, /studio:inbox/);
assert.match(main, /studio:reply/);
assert.match(main, /demoInbox/);
assert.match(main, /backgroundColor: "#ffffff"/);
assert.doesNotMatch(main, /#0c0c0e|#141416/);

assert.match(readme, /npm start/);
assert.match(readme, /Chat \+ Board/);
assert.match(readme, /on demand/);
assert.match(readme, /macOS/);
assert.match(readme, /Windows/);
assert.match(readme, /CATALOG/);
assert.match(readme, /Visibility law/);
assert.match(readme, /connector problems/);
assert.match(readme, /two-way|TWO-WAY|bound/);
assert.match(readme, /inbox entry|inbox filter/);
assert.match(readme, /runtime/);
assert.match(readme, /Token meter|token meter/);
assert.match(readme, /need_you=false|quiet/);
assert.doesNotMatch(readme, /always visible/);

assert.ok(fs.existsSync(path.join(root, "design", "TOKEN-UX.md")));
assert.ok(fs.existsSync(path.join(root, "renderer", "chrome", "token-meter.js")));
assert.match(read("renderer/chrome/token-meter.js"), /unknown|omit|knownTokens/);
assert.match(read("lib/read-ingress.js"), /tryLoadIngress/);
assert.doesNotMatch(read("lib/read-ingress.js"), /writeFile|writeFileSync/);
assert.ok(fs.existsSync(path.join(root, "design", "CONNECTORS-TWO-WAY.md")));
assert.ok(fs.existsSync(path.join(root, "design", "CONNECTORS-TWOWAY.md")));
assert.ok(fs.existsSync(path.join(root, "design", "VISIBILITY.md")));
assert.match(read("design/CONNECTORS-TWO-WAY.md"), /bidirectional/);
assert.match(read("design/CONNECTORS-TWOWAY.md"), /inbox entry/);
assert.match(read("lib/two-way.js"), /P0_WIRE/);
assert.match(read("lib/two-way.js"), /runtime not present/);
assert.doesNotMatch(read("lib/two-way.js"), /function stubReply/);
assert.doesNotMatch(read("lib/two-way.js"), /function humanGateAllows/);
assert.doesNotMatch(read("lib/two-way.js"), /function cutoverAllows/);
assert.deepEqual(twoWay.P0_WIRE.slice().sort(), ["github", "slack"]);
assert.deepEqual(twoWay.TRAY_DEFAULT.slice().sort(), ["live", "needs_auth"]);
assert.deepEqual(twoWay.TRAY_STATES.slice().sort(), ["disconnected", "error", "live", "needs_auth"]);
assert.equal(twoWay.trayStatus("error"), "error");
assert.equal(twoWay.trayStatus("disconnected"), "disconnected");
assert.deepEqual(twoWay.trayStates().slice().sort(), ["disconnected", "error", "live", "needs_auth"]);
assert.doesNotMatch(read("lib/two-way.js"), /writeFile|writeFileSync/);
assert.match(read("scripts/preview.js"), /twoway\/inbox/);
assert.match(read("scripts/preview.js"), /twoway\/reply/);
assert.ok(fs.existsSync(path.join(root, "design", "quiet-studio.html")));
assert.match(read("design/VISIBILITY.md"), /Only necessary information should be visible/);
assert.ok(fs.existsSync(path.join(root, "design", "PRODUCT-NARRATIVE.md")));
assert.ok(fs.existsSync(path.join(root, "design", "LAYOUT-LOCK.md")));
assert.ok(fs.existsSync(path.join(root, "design", "SHELL-IA.md")));
assert.ok(fs.existsSync(path.join(root, "renderer", "chrome", "connectors-tray.js")));
assert.ok(fs.existsSync(path.join(root, "renderer", "chrome", "modes-rail.js")));
assert.ok(fs.existsSync(path.join(root, "renderer", "chrome", "presence-bar.js")));
assert.ok(fs.existsSync(path.join(root, "renderer", "panes", "chat-pane.js")));
assert.ok(fs.existsSync(path.join(root, "renderer", "panes", "board-pane.js")));
assert.ok(fs.existsSync(path.join(root, "renderer", "panes", "code-drawer.js")));

const shellFiles = fs.readdirSync(root);
assert.ok(shellFiles.includes("electron"));
assert.ok(shellFiles.includes("renderer"));
assert.ok(!shellFiles.includes("src-tauri"), "this lane is Electron, not the old Tauri spike");

assert.equal(seats.DEFAULT_CHROME[0], "Chat");
assert.equal(seats.DEFAULT_CHROME[1], "Board");
assert.equal(seats.CODE_MODE, "on-demand");
assert.equal(seats.IN_STUDIO_ONLY_LABEL, IN_STUDIO_ONLY_LABEL);
assert.equal(seats.CONNECT_ACK, CONNECT_ACK);
assert.deepEqual(DEFAULT_SEAT_IDS.slice().sort(), ["claude", "cursor", "grok", "human"]);

const roster = coldOpenSeats();
assert.equal(roster[0].id, "human");
assert.equal(roster[0].name, "You");
assert.equal(roster[0].presence, "online");
assert.equal(roster[0].cutover, true);
for (const id of ["grok", "claude", "cursor"]) {
  const seat = roster.find((item) => item.id === id);
  assert.ok(seat, `missing cold-open seat ${id}`);
  assert.equal(seat.presence, "offline");
  assert.equal(seat.cutover, false);
}
assert.ok(roster.some((item) => item.id === "room:chat"));
assert.ok(!roster.some((item) => item.id === "luke"));

assert.equal(CATALOG_REL, "studio/connectors/CATALOG.md");
assert.ok(catalogPath().endsWith(path.join("studio", "connectors", "CATALOG.md")));
assert.doesNotMatch(read("lib/read-catalog.js"), /writeFile|writeFileSync/);
assert.doesNotMatch(js, /studio\/connectors\//);

const p0 = tryReadCatalogP0();
if (catalogPresent()) {
  assert.ok(p0.length >= 5, "catalog P0 should be multi-provider when present");
  for (const row of p0) {
    assert.match(js, new RegExp(`id: "${row.id}"`), `fallback missing catalog P0 ${row.id}`);
    assert.equal(row.status, "needs_auth");
  }
  assert.ok(p0.some((row) => row.id === "github"));
  assert.ok(p0.some((row) => row.id === "claude"));
  assert.ok(p0.some((row) => row.id === "grok"));
  assert.ok(p0.some((row) => row.id === "cursor"));
  assert.ok(
    !p0.some((row) => row.id === "slack"),
    "Slack is P1 / p0_wire, not a catalog P0 tray row",
  );
  const wire = tryReadTwoWayWire();
  assert.ok(wire.some((row) => row.id === "github"), "two-way wire includes GitHub");
  assert.ok(wire.some((row) => row.id === "slack"), "two-way wire includes Slack");
  const inbox = twoWay.demoInbox();
  assert.ok(inbox.length >= 1, "demo inbox should ingest at least one need-you item");
  assert.ok(inbox.every((item) => item.need_you === true));
  assert.ok(inbox.every((item) => twoWay.shouldTrayPing(item)));
  assert.ok(!inbox.some((item) => item.need_you === false), "quiet default: no need_you=false tray ping");
  assert.ok(inbox.some((item) => item.provider === "github"), "P0 inbox includes GitHub");
  assert.ok(inbox.some((item) => item.provider === "slack"), "P0 inbox includes Slack");
  assert.ok(inbox.some((item) => item.kind === "ci_failure"), "GitHub CI@you lands on inbox");
  assert.ok(inbox.some((item) => item.kind === "mention"), "Slack app_mention lands on inbox");
  assert.ok(inbox.some((item) => item.kind === "dm"), "Slack DM mention lands on inbox");
  if (ingressPresent()) {
    assert.equal(INGRESS_REL, "studio/connectors/ingress");
    assert.ok(tryLoadIngress());
    const quiet = twoWay.quietPingDropped();
    assert.equal(quiet.dropped, true, "github ping must drop");
    assert.equal(quiet.items.length, 0, "dropped ping must not enter inbox");
  }
  const unboundDraft = {
    provider: "github",
    actor: "human",
    kind: "issue_comment",
    tray_state: "live",
    bound_to: "",
    body: "hi",
    thread_ref: { owner: "you", repo: "your-repo", issue_number: 14 },
  };
  const botDraft = {
    provider: "github",
    actor: "bot",
    kind: "issue_comment",
    tray_state: "live",
    bound_to: inbox[0].id,
    body: "bot free-fire",
    thread_ref: inbox[0].thread_ref,
    cutover: { status: "attached", in_studio_only: true },
    human_gate: { status: "pending" },
  };
  if (twoWay.runtimePresent()) {
    const unbound = twoWay.sendReply(unboundDraft);
    assert.equal(unbound.ok, false);
    assert.equal(unbound.code, "UNBOUND_REPLY");
    const botNoGate = twoWay.sendReply(botDraft);
    assert.equal(botNoGate.ok, false);
    assert.equal(botNoGate.code, "BOT_SEND_NO_GATE");
  } else {
    const missing = twoWay.sendReply(unboundDraft);
    assert.equal(missing.ok, false);
    assert.equal(missing.detail, "runtime not present");
  }
} else {
  assert.deepEqual(p0, []);
}

process.stdout.write("studio/shell smoke ok\n");
