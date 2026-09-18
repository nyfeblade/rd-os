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

assert.match(html, /id="mode-chip"/);
assert.match(html, /id="watches"/);
assert.match(html, /id="btn-code"/);
assert.match(html, /id="hint-code"/);
assert.match(html, /id="btn-close"/);
assert.match(html, /id="connectors-tray"/);
assert.match(html, /id="instruments"/);
assert.match(html, /id="presence-btn"/);
assert.match(html, /id="cutover-sheet"/);
assert.match(html, /This seat works in Studio only while connected/);
assert.match(html, /code-pane/);
assert.match(html, /hidden/);
assert.doesNotMatch(html, /data-nav="waiting"/);
assert.doesNotMatch(html, /Waiting · Experiments · History/);
assert.doesNotMatch(html, /class="main code-open"/);

assert.match(css, /\.code-pane\s*\{\s*display:\s*none/);
assert.match(css, /\.main\.code-open \.code-pane/);
assert.match(css, /grid-template-columns:\s*1\.35fr 0\.9fr/);
assert.doesNotMatch(css, /minmax\(280px,\s*1\.05fr\).*minmax\(360px/);

assert.match(js, /nextMode/);
assert.match(js, /nightly proof packet/);
assert.match(js, /CloudAgent/);
assert.match(js, /instrumentFor/);
assert.match(js, /setCodeOpen/);
assert.match(js, /codeOpen:\s*false/);
assert.match(js, /setCodeOpen\(false\)/);
assert.match(js, /in studio/);
assert.match(js, /This seat works in Studio only while connected/);
assert.match(js, /attention\.(human|dump)/);

assert.match(tokens, /--bg:\s*#111113/);
assert.match(tokens, /--accent:\s*#a5b4fc/);

assert.match(main, /DEFAULT_WIDTH = 1440/);
assert.match(main, /DEFAULT_HEIGHT = 900/);
assert.match(main, /MIN_WIDTH = 1200/);
assert.match(main, /MIN_HEIGHT = 720/);

assert.match(readme, /npm start/);
assert.match(readme, /Chat \+ Board/);
assert.match(readme, /on demand/);
assert.doesNotMatch(readme, /always visible/);
assert.match(js, /review/);
assert.doesNotMatch(js, /integrate/);
assert.ok(fs.existsSync(path.join(root, "design", "quiet-studio.html")));
assert.match(readme, /macOS/);
assert.match(readme, /Windows/);
assert.ok(fs.existsSync(path.join(root, "design", "PRODUCT-NARRATIVE.md")));

const shellFiles = fs.readdirSync(root);
assert.ok(shellFiles.includes("electron"));
assert.ok(shellFiles.includes("renderer"));
assert.ok(!shellFiles.includes("src-tauri"), "this lane is Electron, not the old Tauri spike");

process.stdout.write("studio/shell smoke ok\n");
