#!/usr/bin/env node
"use strict";

/**
 * Prove Chat is engine-backed: bind + send persist through studio/chat-engine.
 * Exit 2 if the shell is still fixture-only theater.
 *
 *   cd studio/shell && npm test
 *   node scripts/prove-chat.js
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createChatSession, defaultRepoPath, describeChrome, ENGINE_REL } = require("../lib/chat-bridge");

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

function git(args, cwd) {
  const ran = spawnSync("git", ["-c", "safe.directory=*", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
    env: Object.assign({}, process.env, {
      GIT_OPTIONAL_LOCKS: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Studio Shell",
      GIT_AUTHOR_EMAIL: "shell@example.com",
      GIT_COMMITTER_NAME: "Studio Shell",
      GIT_COMMITTER_EMAIL: "shell@example.com",
    }),
  });
  if (ran.status !== 0) {
    throw new Error(String(ran.stderr || ran.stdout || args.join(" ")).trim());
  }
  return String(ran.stdout || "").trim();
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-shell-chat-"));
  git(["init", "-b", "main"], dir);
  git(["config", "user.email", "shell@example.com"], dir);
  git(["config", "user.name", "Studio Shell"], dir);
  fs.writeFileSync(path.join(dir, "README.md"), "shell chat prove\n", "utf8");
  git(["add", "."], dir);
  git(["commit", "--no-gpg-sign", "-m", "init prove"], dir);
  fs.writeFileSync(path.join(dir, "DIRTY.txt"), "unstaged\n", "utf8");
  return dir;
}

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-shell-engine-"));
}

function stubEngine() {
  return {
    github: {
      readPrForBranch: async () => ({ ok: true, data: null }),
      readChecks: async () => ({ ok: true, data: null }),
      readReviews: async () => ({ ok: true, data: null }),
    },
  };
}

async function main() {
  const bridge = read("lib/chat-bridge.js");
  const mainJs = read("electron/main.js");
  const preload = read("electron/preload.js");
  const preview = read("scripts/preview.js");
  const app = read("renderer/app.js");
  const chat = read("renderer/panes/chat-pane.js");
  const html = read("renderer/index.html");
  const readme = read("README.md");

  if (!bridge.includes("createChatEngine")) {
    fail("bridge", "chat-bridge must require createChatEngine — not a fixture stub");
  }
  if (!bridge.includes("memory.write")) {
    fail("bridge", "composer persist must call engine.memory.write");
  }
  if (/function resolveGitRoot/.test(bridge) || /function refreshSnapshot/.test(bridge)) {
    fail("bridge", "do not copy bind/snapshot/git out of chat-engine");
  }
  if (!mainJs.includes("createChatSession") || !mainJs.includes("studio:chat.bind")) {
    fail("main", "Electron main must bind chat-engine on start");
  }
  if (!preload.includes("studio:chat.send")) {
    fail("preload", "preload must expose chat.send");
  }
  if (!preview.includes("/chat/bind") || !preview.includes("/chat/send")) {
    fail("preview", "preview must expose /chat/bind and /chat/send");
  }
  if (!app.includes('chatInvoke("send"') || !app.includes('chatInvoke("bind"')) {
    fail("renderer", "composer/boot must call chatInvoke bind+send");
  }
  if (/Studio\.panes\.pushLocal\(seat\.id/.test(app)) {
    fail("renderer", "composer still pushes local fixture theater");
  }
  if (!chat.includes("engine.messages") && !chat.includes("state.engine.messages")) {
    fail("chat-pane", "transcript must read engine.messages");
  }
  if (!html.includes("id=\"bind-status\"")) {
    fail("html", "missing bind-status chrome");
  }
  if (html.includes("class=\"main code-open\"")) {
    fail("ia", "Code must stay closed by default");
  }
  if (!readme.includes("chat-engine") || !readme.includes("npm test")) {
    fail("readme", "README must document engine bind + prove");
  }
  pass("source fence: engine required, fixtures not the only path");

  const repo = defaultRepoPath();
  let toplevel = "";
  try {
    toplevel = git(["rev-parse", "--show-toplevel"], repo);
  } catch (err) {
    fail("default repo", `${repo} is not a git work tree: ${err && err.message ? err.message : err}`);
  }
  if (path.resolve(toplevel) !== path.resolve(repo)) {
    fail("default repo", `defaultRepoPath ${repo} is not git toplevel ${toplevel}`);
  }
  pass(`default repo is a git root (${path.basename(repo)})`);

  const fixture = makeRepo();
  const home = tmpHome();
  const nonce = `prove-persist-${Date.now()}`;
  const session = createChatSession({
    home,
    repo: fixture,
    varDir: home,
    persistPrefs: false,
    engine: stubEngine(),
  });

  const bound = await session.bind(fixture);
  if (!bound.ok) {
    fail("bind", `${bound.code}: ${bound.detail}`);
  }
  const state = bound.state;
  if (!state.thread || !/^thr_[a-f0-9]{24}$/.test(state.thread.id)) {
    fail("thread", `expected engine thread id, got ${state.thread && state.thread.id}`);
  }
  if (state.engine !== ENGINE_REL) {
    fail("engine mark", `expected ${ENGINE_REL}, got ${state.engine}`);
  }
  if (state.snapshot.branch !== "main") {
    fail("snapshot.branch", `expected main, got ${state.snapshot && state.snapshot.branch}`);
  }
  if (state.snapshot.dirty !== true) {
    fail("snapshot.dirty", "fixture repo should be dirty");
  }
  if (state.chrome.dirty !== "dirty" || state.chrome.branch !== "main") {
    fail("chrome", `expected repo · main · dirty, got ${describeChrome(state.chrome)}`);
  }
  if (!state.messages.some((row) => row.kind === "system")) {
    fail("transcript", "engine pack system line missing");
  }
  pass(`bind ${state.thread.id} ${describeChrome(state.chrome)}`);

  const sent = await session.send(nonce);
  if (!sent.ok) {
    fail("send", `${sent.code}: ${sent.detail}`);
  }
  if (!sent.state.messages.some((row) => row.me === true && row.body === nonce)) {
    fail("send transcript", "engine transcript missing the sent note");
  }
  const listed = session.engine.memory.list(state.thread.id);
  if (!listed.ok || !listed.data.thread.some((row) => row.kind === "note" && row.text === nonce)) {
    fail("send persist", "memory.write did not keep the note");
  }
  pass("send writes engine memory");

  const empty = await session.send("   ");
  if (empty.ok || empty.code !== "BAD_ARGUMENT") {
    fail("empty send", `expected BAD_ARGUMENT, got ${JSON.stringify(empty)}`);
  }
  pass("empty send rejected");

  const focused = await session.setCodeFocus(true);
  if (!focused.ok) {
    fail("focus", `${focused.code}: ${focused.detail}`);
  }
  const focus = session.state().focus;
  if (!focus || focus.source !== "code" || focus.path !== "README.md") {
    fail("focus", `expected README.md source=code, got ${JSON.stringify(focus)}`);
  }
  pass("Code drawer pushes focus.source=code");

  const reopened = createChatSession({
    home,
    repo: fixture,
    varDir: home,
    persistPrefs: false,
    engine: stubEngine(),
  });
  const again = await reopened.bind(fixture);
  if (!again.ok) {
    fail("reopen bind", `${again.code}: ${again.detail}`);
  }
  if (again.state.thread.id !== state.thread.id) {
    fail("reopen thread", `expected ${state.thread.id}, got ${again.state.thread.id}`);
  }
  if (!again.state.messages.some((row) => row.body === nonce && row.me === true)) {
    fail("reopen persist", "cold reopen lost the sent note — still fixture theater");
  }
  const memory = reopened.engine.memory.list(again.state.thread.id);
  if (!memory.ok || !memory.data.thread.some((row) => row.text === nonce)) {
    fail("reopen memory", "engine home did not survive a second createChatSession");
  }
  pass("reopen restores the same thread + sent note");

  const missingHome = tmpHome();
  const unbound = createChatSession({
    home: missingHome,
    varDir: missingHome,
    persistPrefs: false,
    engine: stubEngine(),
  });
  const rejected = await unbound.send(nonce);
  if (rejected.ok || rejected.code !== "UNBOUND_THREAD") {
    fail("unbound send", `expected UNBOUND_THREAD before bind, got ${JSON.stringify(rejected)}`);
  }
  pass("send before bind is UNBOUND_THREAD");

  const liveRoot = defaultRepoPath();
  const liveHome = tmpHome();
  const live = createChatSession({
    home: liveHome,
    repo: liveRoot,
    varDir: liveHome,
    persistPrefs: false,
    engine: stubEngine(),
  });
  const liveBound = await live.bind();
  if (!liveBound.ok) {
    fail("rd-os bind", `${liveBound.code}: ${liveBound.detail}`);
  }
  if (!liveBound.state.snapshot.head_short) {
    fail("rd-os snapshot", "HEAD missing on default repo");
  }
  const liveNote = `rd-os-${nonce}`;
  const liveSent = await live.send(liveNote);
  if (!liveSent.ok) {
    fail("rd-os send", `${liveSent.code}: ${liveSent.detail}`);
  }
  const liveAgain = createChatSession({
    home: liveHome,
    repo: liveRoot,
    varDir: liveHome,
    persistPrefs: false,
    engine: stubEngine(),
  });
  const liveReopen = await liveAgain.bind();
  if (!liveReopen.ok || !liveReopen.state.messages.some((row) => row.body === liveNote)) {
    fail("rd-os reopen", "default-repo send did not persist");
  }
  pass(`rd-os toplevel bind+send persists (${liveBound.state.chrome.repo} · ${liveBound.state.chrome.branch})`);

  process.stdout.write("studio/shell prove-chat ok\n");
}

main().catch((err) => {
  fail("prove", err && err.stack ? err.stack : String(err));
});
