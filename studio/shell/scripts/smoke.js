"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const html = read("renderer/index.html");
const css = read("renderer/styles.css");
const tokens = read("renderer/tokens.css");
const js = read("renderer/app.js");
const main = read("electron/main.js");
const readme = read("README.md");

for (const pane of ["chat", "code", "board"]) {
  assert.match(html, new RegExp(`data-pane="${pane}"`), `missing ${pane} pane`);
}

assert.match(html, /id="connectors-tray"/);
assert.match(html, /id="presence-btn"/);
assert.match(html, /id="cutover-sheet"/);
assert.match(html, /This seat works in Studio only while connected/);
assert.doesNotMatch(html, /data-nav="waiting"/);
assert.doesNotMatch(html, /Waiting · Experiments · History/);

assert.match(js, /in-studio-only/);
assert.match(js, /This seat works in Studio only while connected/);
assert.match(js, /connectors/);
assert.match(js, /attention\.(human|dump)/);

assert.match(tokens, /--bg:\s*#0e0e10/);
assert.match(tokens, /--accent:\s*#6b8afd/);
assert.match(css, /minmax\(280px/);
assert.match(css, /min-width:\s*1200px/);

assert.match(main, /DEFAULT_WIDTH = 1440/);
assert.match(main, /DEFAULT_HEIGHT = 900/);
assert.match(main, /MIN_WIDTH = 1200/);
assert.match(main, /MIN_HEIGHT = 720/);
assert.match(main, /AI Coding Studio/);

assert.match(readme, /npm start/);
assert.match(readme, /macOS/);
assert.match(readme, /Windows/);
assert.match(readme, /studio\/shell/);

const shellFiles = fs.readdirSync(root);
assert.ok(shellFiles.includes("electron"));
assert.ok(shellFiles.includes("renderer"));
assert.ok(!shellFiles.includes("src-tauri"), "this lane is Electron, not the old Tauri spike");

process.stdout.write("studio/shell smoke ok\n");
