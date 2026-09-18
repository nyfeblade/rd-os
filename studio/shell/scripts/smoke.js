"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const { CATALOG_REL, catalogPath, catalogPresent, tryReadCatalogP0 } = require("../lib/read-catalog");
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
assert.match(html, /Connect a seat to start/);
assert.match(html, /Message seat or #room/);
assert.match(html, /id="mode-name"/);
assert.match(html, />eng</);
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
assert.match(css, /grid-template-columns:\s*1fr 340px/);
assert.match(css, /\.icons button\.auth::after/);
assert.match(css, /\.icons button\.live::after/);
assert.match(css, /1fr 420px 320px/);
assert.doesNotMatch(css, /minmax\(280px,\s*1\.05fr\).*minmax\(360px/);

assert.match(js, /codeOpen:\s*false/);
assert.match(js, /setCodeOpen\(els, state, false\)/);
assert.match(js, /attention\.empty\.json/);
assert.match(js, /attention\.(human|dump)/);
assert.match(js, /loadCatalog/);
assert.match(js, /FALLBACK_P0/);
assert.match(js, /mode: "eng"/);
assert.match(js, /needs_auth/);
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
assert.match(chat, /Connect a seat to start/);
assert.match(chat, /in-studio-only/);
assert.match(chat, /person on/);
assert.doesNotMatch(chat, /Eng Lead/);

assert.match(board, /Nothing blocked on you/);
assert.match(board, /instrumentFor/);
assert.match(board, /nightly proof packet/);
assert.match(board, /Agent map/);
assert.match(board, /CA map/);
assert.match(board, /Open diff/);
assert.doesNotMatch(board, /nyfeblade\/rd-os/);
assert.doesNotMatch(board, /PR#11/);

assert.match(code, /setCodeOpen/);
assert.match(tray, /Connect GitHub \/ an agent provider/);
assert.match(tray, /iconGlyph/);
assert.match(tray, /case "github"/);
assert.match(modes, /nextMode/);
assert.match(modes, /case "eng"/);
assert.match(modes, /case "design"/);
assert.doesNotMatch(modes, /review/);
assert.match(presence, /in-studio-only/);

assert.match(tokens, /--bg:\s*#0c0c0e/);
assert.match(tokens, /--accent:\s*#c4b5fd/);
assert.match(tokens, /--surface:\s*#141416/);

assert.match(main, /DEFAULT_WIDTH = 1440/);
assert.match(main, /DEFAULT_HEIGHT = 900/);
assert.match(main, /MIN_WIDTH = 1200/);
assert.match(main, /MIN_HEIGHT = 720/);
assert.match(main, /tryReadCatalogP0/);

assert.match(readme, /npm start/);
assert.match(readme, /Chat \+ Board/);
assert.match(readme, /on demand/);
assert.match(readme, /macOS/);
assert.match(readme, /Windows/);
assert.match(readme, /CATALOG/);
assert.doesNotMatch(readme, /always visible/);

assert.ok(fs.existsSync(path.join(root, "design", "quiet-studio.html")));
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
} else {
  assert.deepEqual(p0, []);
}

process.stdout.write("studio/shell smoke ok\n");
