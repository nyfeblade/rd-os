#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  createChatEngine,
  authorizeTool,
  listTools,
  describeReject,
  parseGithubRemote,
  publicRemoteUrl,
  SCHEMA,
  FENCE,
  PRODUCT_LOCK,
  ASSUME_SNAPSHOT_TRUTH,
  DEFAULT_MODE,
  REJECT_CODES,
  CODING_ALLOW,
  CODING_DENY,
  HANDOFF_TARGETS,
  TOOL_FAMILY,
  describeFamily,
} = require("..");
const { defaultExecGit } = require("../lib/git");

const LIVE_ROOT = path.resolve(__dirname, "../../..");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-chat-engine-"));
}

function git(args, cwd) {
  const ran = spawnSync("git", ["-c", "safe.directory=*", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
    env: Object.assign({}, process.env, {
      GIT_OPTIONAL_LOCKS: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Chat Engine",
      GIT_AUTHOR_EMAIL: "engine@example.com",
      GIT_COMMITTER_NAME: "Chat Engine",
      GIT_COMMITTER_EMAIL: "engine@example.com",
    }),
  });
  if (ran.status !== 0) {
    throw new Error(String(ran.stderr || ran.stdout || args.join(" ")).trim());
  }
  return String(ran.stdout || "").trim();
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-engine-repo-"));
  git(["init", "-b", "main"], dir);
  git(["config", "user.email", "engine@example.com"], dir);
  git(["config", "user.name", "Chat Engine"], dir);
  fs.writeFileSync(path.join(dir, "README.md"), "hello engine\n", "utf8");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "app.js"), "module.exports = 1;\n", "utf8");
  git(["add", "."], dir);
  git(["commit", "--no-gpg-sign", "-m", "init engine fixture"], dir);
  fs.writeFileSync(path.join(dir, "src", "app.js"), "module.exports = 2;\n", "utf8");
  git(["add", "src/app.js"], dir);
  git(["commit", "--no-gpg-sign", "-m", "touch app"], dir);
  return dir;
}

function eq(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function runCase(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((result) => {
      if (result && result.ok === false && result.error) {
        return { name, ok: false, detail: result.error };
      }
      return { name, ok: true };
    })
    .catch((err) => ({
      name,
      ok: false,
      detail: err && err.message ? err.message : String(err),
    }));
}

function expectReject(result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `expected ${code}, got ${result && result.ok ? "ok" : result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true };
}

function expectOk(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true, data: result.data };
}

async function cases() {
  const rows = [];
  const fixture = makeRepo();

  rows.push(
    await runCase("orphan open without repo is UNBOUND_THREAD", () => {
      return expectReject(createChatEngine({ home: tmpHome() }).threads.open({}), "UNBOUND_THREAD");
    })
  );

  rows.push(
    await runCase("missing path is BIND_PATH_MISSING", () => {
      return expectReject(
        createChatEngine({ home: tmpHome() }).threads.open({ repo: path.join(os.tmpdir(), "no-such-chat-engine-repo") }),
        "BIND_PATH_MISSING"
      );
    })
  );

  rows.push(
    await runCase("non-git directory is BIND_NOT_GIT", () => {
      const bare = fs.mkdtempSync(path.join(os.tmpdir(), "not-git-"));
      return expectReject(createChatEngine({ home: tmpHome() }).threads.open({ repo: bare }), "BIND_NOT_GIT");
    })
  );

  rows.push(
    await runCase("bind fixture repo → snapshot branch dirty HEAD commits", async () => {
      fs.writeFileSync(path.join(fixture, "DIRTY.txt"), "unstaged\n", "utf8");
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const thread = opened.data.thread;
      if (!thread.bind || thread.bind.git_root !== fs.realpathSync(fixture)) {
        return { ok: false, error: `bind ${JSON.stringify(thread.bind)}` };
      }
      const snap = expectOk(await engine.snapshot.refresh(thread.id));
      if (!snap.ok) {
        return snap;
      }
      const s = snap.data.snapshot;
      if (s.branch !== "main") {
        return { ok: false, error: `branch=${s.branch}` };
      }
      if (!s.dirty || !s.dirty_files.some((row) => row.path === "DIRTY.txt")) {
        return { ok: false, error: `dirty ${JSON.stringify(s.dirty_files)}` };
      }
      const head = git(["rev-parse", "HEAD"], fixture);
      if (s.head !== head || s.head_short !== head.slice(0, 12)) {
        return { ok: false, error: `head ${s.head} != ${head}` };
      }
      if (!Array.isArray(s.commits) || s.commits.length < 2) {
        return { ok: false, error: `commits ${s.commits && s.commits.length}` };
      }
      if (s.commits[0].subject !== "touch app") {
        return { ok: false, error: `log ${s.commits[0].subject}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("snapshot refresh sees new dirty without paste", async () => {
      const repo = makeRepo();
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo }));
      if (!opened.ok) {
        return opened;
      }
      const first = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!first.ok) {
        return first;
      }
      if (first.data.snapshot.dirty !== false) {
        return { ok: false, error: "fixture should start clean" };
      }
      fs.writeFileSync(path.join(repo, "NEW.txt"), "live\n", "utf8");
      const second = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!second.ok) {
        return second;
      }
      if (!second.data.snapshot.dirty || !second.data.snapshot.dirty_files.some((row) => row.path === "NEW.txt")) {
        return { ok: false, error: "refresh missed NEW.txt" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("bind this repo cwd and match git HEAD/branch", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: LIVE_ROOT }));
      if (!opened.ok) {
        return opened;
      }
      const snap = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!snap.ok) {
        return snap;
      }
      const head = defaultExecGit(["rev-parse", "HEAD"], { cwd: LIVE_ROOT });
      const branch = defaultExecGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: LIVE_ROOT });
      if (!head.ok || snap.data.snapshot.head !== String(head.stdout).trim()) {
        return { ok: false, error: `live head ${snap.data.snapshot.head}` };
      }
      const name = String(branch.stdout || "").trim();
      if (name && name !== "HEAD" && snap.data.snapshot.branch !== name) {
        return { ok: false, error: `live branch ${snap.data.snapshot.branch} != ${name}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("focus pointer confined and injected into pack", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const id = opened.data.thread.id;
      const escaped = expectReject(engine.focus.set(id, { path: "../../etc/passwd", source: "explicit" }), "PATH_OUTSIDE_REPO");
      if (!escaped.ok) {
        return escaped;
      }
      const set = expectOk(engine.focus.set(id, { path: "src/app.js", source: "code", line: 1, column: 0 }));
      if (!set.ok) {
        return set;
      }
      if (set.data.focus.path !== "src/app.js" || set.data.focus.source !== "code" || set.data.focus.line !== 1) {
        return { ok: false, error: JSON.stringify(set.data.focus) };
      }
      const packed = expectOk(await engine.context.pack(id));
      if (!packed.ok) {
        return packed;
      }
      if (!packed.data.pack.focus || packed.data.pack.focus.path !== "src/app.js") {
        return { ok: false, error: "focus missing from pack" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("last-touched inferred from dirty path", async () => {
      const repo = makeRepo();
      fs.writeFileSync(path.join(repo, "src", "app.js"), "module.exports = 3;\n", "utf8");
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo }));
      if (!opened.ok) {
        return opened;
      }
      const snap = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!snap.ok) {
        return snap;
      }
      if (!snap.data.thread.focus || snap.data.thread.focus.path !== "src/app.js") {
        return { ok: false, error: JSON.stringify(snap.data.thread.focus) };
      }
      if (snap.data.thread.focus.source !== "last_touched") {
        return { ok: false, error: `source ${snap.data.thread.focus.source}` };
      }
      git(["checkout", "--", "src/app.js"], repo);
      fs.writeFileSync(path.join(repo, "OTHER.txt"), "next\n", "utf8");
      const again = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!again.ok) {
        return again;
      }
      if (!again.data.thread.focus || again.data.thread.focus.path !== "OTHER.txt") {
        return { ok: false, error: `stale last_touched ${JSON.stringify(again.data.thread.focus)}` };
      }
      const pinned = expectOk(engine.focus.set(opened.data.thread.id, { path: "README.md", source: "code" }));
      if (!pinned.ok) {
        return pinned;
      }
      fs.writeFileSync(path.join(repo, "THIRD.txt"), "ignored\n", "utf8");
      const held = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!held.ok) {
        return held;
      }
      if (!held.data.thread.focus || held.data.thread.focus.path !== "README.md" || held.data.thread.focus.source !== "code") {
        return { ok: false, error: "code focus must not be overwritten by last_touched" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("thread + project memory survives reopen", () => {
      const home = tmpHome();
      const a = createChatEngine({ home });
      const opened = expectOk(a.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const id = opened.data.thread.id;
      const decision = expectOk(
        a.memory.write(id, { scope: "project", kind: "decision", text: "use snapshot, do not paste" })
      );
      if (!decision.ok) {
        return decision;
      }
      const attempt = expectOk(
        a.memory.write(id, { scope: "thread", kind: "attempt", text: "we tried X", paths: ["src/app.js"] })
      );
      if (!attempt.ok) {
        return attempt;
      }
      const b = createChatEngine({ home });
      const listed = expectOk(b.memory.list(id));
      if (!listed.ok) {
        return listed;
      }
      if (listed.data.project.length !== 1 || listed.data.project[0].text.indexOf("snapshot") < 0) {
        return { ok: false, error: "project memory lost" };
      }
      if (listed.data.thread.length !== 1 || listed.data.thread[0].kind !== "attempt") {
        return { ok: false, error: "thread memory lost" };
      }
      const other = expectOk(b.threads.open({ repo: fixture }));
      if (!other.ok) {
        return other;
      }
      const shared = expectOk(b.memory.list(other.data.thread.id, { scope: "project" }));
      if (!shared.ok) {
        return shared;
      }
      if (shared.data.project.length !== 1) {
        return { ok: false, error: "project memory not shared across threads" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("coding-mode allowlist rejects denylist tools", () => {
      const food = authorizeTool("coding", "life.food");
      const flights = authorizeTool("coding", "life.flights");
      const fleet = authorizeTool("coding", "fleet.ack");
      const browse = authorizeTool("coding", "web.browse");
      const asked = authorizeTool("coding", "web.browse", { asked: true });
      const gitStatus = authorizeTool("coding", "git.status");
      const unknown = authorizeTool("coding", "calendar.book");
      if (expectReject(food, "LIFE_OS_DENIED").ok === false) {
        return expectReject(food, "LIFE_OS_DENIED");
      }
      if (expectReject(flights, "LIFE_OS_DENIED").ok === false) {
        return expectReject(flights, "LIFE_OS_DENIED");
      }
      if (expectReject(fleet, "TOOL_DENIED").ok === false) {
        return expectReject(fleet, "TOOL_DENIED");
      }
      if (expectReject(browse, "TOOL_DENIED").ok === false) {
        return expectReject(browse, "TOOL_DENIED");
      }
      if (!asked.ok || !gitStatus.ok) {
        return { ok: false, error: "asked browse or git.status should pass" };
      }
      if (expectReject(unknown, "UNKNOWN_TOOL").ok === false) {
        return expectReject(unknown, "UNKNOWN_TOOL");
      }
      const listed = listTools("coding");
      if (!eq(listed.allow, CODING_ALLOW.slice()) || listed.deny.indexOf("life.food") < 0) {
        return { ok: false, error: "coding list drifted" };
      }
      if (listed.allow.indexOf("fleet.ack") >= 0 || listed.allow.indexOf("life.food") >= 0) {
        return { ok: false, error: "denylist leaked into allow" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("engine invoke enforces allowlist and runs fs/git", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const id = opened.data.thread.id;
      const denied = await engine.tools.invoke(id, "life.journal", {});
      if (expectReject(denied, "LIFE_OS_DENIED").ok === false) {
        return expectReject(denied, "LIFE_OS_DENIED");
      }
      const listed = expectOk(await engine.tools.invoke(id, "fs.list", { path: "src" }));
      if (!listed.ok) {
        return listed;
      }
      if (!listed.data.entries.some((row) => row.name === "app.js")) {
        return { ok: false, error: "fs.list missed app.js" };
      }
      const status = expectOk(await engine.tools.invoke(id, "git.branch", {}));
      if (!status.ok) {
        return status;
      }
      if (status.data.branch !== "main") {
        return { ok: false, error: `git.branch ${status.data.branch}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("general mode keeps bind and allows web.browse", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture, mode: "general" }));
      if (!opened.ok) {
        return opened;
      }
      const browse = engine.tools.authorize(opened.data.thread.id, "web.browse");
      if (!browse.ok) {
        return { ok: false, error: `general web.browse ${browse.code}` };
      }
      const food = engine.tools.authorize(opened.data.thread.id, "life.food");
      return expectReject(food, "LIFE_OS_DENIED");
    })
  );

  rows.push(
    await runCase("context pack assumes snapshot truth and hides paste", async () => {
      const engine = createChatEngine({
        home: tmpHome(),
        github: {
          readPrForBranch: async () => ({
            ok: true,
            data: {
              number: 11,
              title: "shell",
              state: "open",
              draft: false,
              html_url: "https://example.test/pr/11",
              updated_at: "2026-01-01T00:00:00Z",
              head: "abc",
            },
          }),
          readChecks: async () => ({
            ok: true,
            data: { conclusion: "failure", failing: ["lint"], runs: [] },
          }),
        },
      });
      const repo = makeRepo();
      git(["remote", "add", "origin", "https://x-access-token:ghs_testtoken@github.com/nyfeblade/rd-os.git"], repo);
      const opened = expectOk(engine.threads.open({ repo }));
      if (!opened.ok) {
        return opened;
      }
      const packed = expectOk(await engine.context.pack(opened.data.thread.id));
      if (!packed.ok) {
        return packed;
      }
      const pack = packed.data.pack;
      if (pack.schema !== "studio.chat.context/v1" || pack.mode !== DEFAULT_MODE) {
        return { ok: false, error: "pack header" };
      }
      if (!pack.system.includes(ASSUME_SNAPSHOT_TRUTH)) {
        return { ok: false, error: "missing assume-truth line" };
      }
      const blob = JSON.stringify(pack);
      if (/please paste/i.test(blob) || /paste the (diff|log|branch)/i.test(blob)) {
        return { ok: false, error: "pack asks for paste" };
      }
      if (!pack.snapshot.open_pr || pack.snapshot.open_pr.number !== 11) {
        return { ok: false, error: "open PR missing from pack" };
      }
      if (!pack.snapshot.checks || pack.snapshot.checks.conclusion !== "failure") {
        return { ok: false, error: "checks missing from pack" };
      }
      const remoteUrl = packed.data.snapshot.remote_url || "";
      if (/x-access-token|ghs_testtoken|@github/i.test(remoteUrl)) {
        return { ok: false, error: `remote leaked secret ${remoteUrl}` };
      }
      if (remoteUrl !== "https://github.com/nyfeblade/rd-os.git") {
        return { ok: false, error: `public remote ${remoteUrl}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("handoff dry-run attaches live snapshot", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const snap = expectOk(await engine.snapshot.refresh(opened.data.thread.id));
      if (!snap.ok) {
        return snap;
      }
      const played = expectOk(
        await engine.handoff.play(opened.data.thread.id, {
          target: "claude_code",
          brief: "fix the failing check",
          dry_run: true,
        })
      );
      if (!played.ok) {
        return played;
      }
      if (played.data.mode !== "dry_run" || played.data.target !== "claude_code") {
        return { ok: false, error: JSON.stringify({ mode: played.data.mode, target: played.data.target }) };
      }
      if (!played.data.payload || played.data.payload.snapshot.head !== snap.data.snapshot.head) {
        return { ok: false, error: "handoff payload missing snapshot head" };
      }
      if (played.data.payload.snapshot.branch !== "main") {
        return { ok: false, error: "handoff payload missing branch" };
      }
      if (!played.data.payload.pack || !played.data.payload.pack.system.includes(ASSUME_SNAPSHOT_TRUTH)) {
        return { ok: false, error: "handoff pack missing assume-truth" };
      }
      const unknown = await engine.handoff.play(opened.data.thread.id, { target: "slack" });
      return expectReject(unknown, "UNKNOWN_HANDOFF_TARGET");
    })
  );

  rows.push(
    await runCase("outcome ingest + poll stub land in thread", async () => {
      const home = tmpHome();
      const engine = createChatEngine({
        home,
        github: {
          readPrForBranch: async () => ({
            ok: true,
            data: {
              number: 9,
              title: "ci",
              state: "open",
              draft: false,
              html_url: "https://example.test/pr/9",
              updated_at: "2026-02-02T00:00:00Z",
              head: "def",
            },
          }),
          readChecks: async () => ({
            ok: true,
            data: { conclusion: "failure", failing: ["test"], runs: [] },
          }),
        },
      });
      const repo = makeRepo();
      git(["remote", "add", "origin", "git@github.com:nyfeblade/rd-os.git"], repo);
      const opened = expectOk(engine.threads.open({ repo }));
      if (!opened.ok) {
        return opened;
      }
      const id = opened.data.thread.id;
      const ingested = expectOk(
        engine.outcomes.ingest(id, { source: "ca", status: "running", summary: "cloud agent started" })
      );
      if (!ingested.ok) {
        return ingested;
      }
      const polled = expectOk(await engine.outcomes.poll(id));
      if (!polled.ok) {
        return polled;
      }
      if (!polled.data.ingested.length) {
        return { ok: false, error: "poll should ingest PR/CI change" };
      }
      const again = expectOk(await engine.outcomes.poll(id));
      if (!again.ok) {
        return again;
      }
      if (again.data.ingested.length !== 0) {
        return { ok: false, error: "poll duplicated fingerprint" };
      }
      const reopened = createChatEngine({ home });
      const listed = expectOk(reopened.outcomes.list(id));
      if (!listed.ok) {
        return listed;
      }
      const sources = listed.data.map((row) => row.source);
      if (sources.indexOf("ca") < 0 || sources.indexOf("ci") < 0) {
        return { ok: false, error: `sources ${sources.join(",")}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("dump is shell-importable and not a dashboard", async () => {
      const engine = createChatEngine({ home: tmpHome() });
      const opened = expectOk(engine.threads.open({ repo: fixture }));
      if (!opened.ok) {
        return opened;
      }
      const dumped = expectOk(await engine.dump(opened.data.thread.id));
      if (!dumped.ok) {
        return dumped;
      }
      const d = dumped.data;
      if (d.schema !== SCHEMA || d.fence !== FENCE || d.product_lock !== PRODUCT_LOCK) {
        return { ok: false, error: "dump header" };
      }
      if (d.clock_started !== false || d.verdict !== null) {
        return { ok: false, error: "dump must not self-cert" };
      }
      if (!d.shell || d.shell.chrome !== "not-owned" || d.shell.dashboard !== false || d.shell.marketplace !== false) {
        return { ok: false, error: "dump leaked chrome" };
      }
      if (d.shell.paste_and_pray !== false || d.shell.sibling_later !== "Board") {
        return { ok: false, error: "dump shell hints" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("closed sets stay exhaustive", () => {
      for (const code of REJECT_CODES) {
        if (!describeReject(code)) {
          return { ok: false, error: `describeReject ${code}` };
        }
      }
      for (const family of TOOL_FAMILY) {
        if (!describeFamily(family)) {
          return { ok: false, error: `describeFamily ${family}` };
        }
      }
      if (!eq(HANDOFF_TARGETS.slice(), ["cursor_ca", "claude_code"])) {
        return { ok: false, error: "handoff targets" };
      }
      const ssh = parseGithubRemote("git@github.com:nyfeblade/rd-os.git");
      const https = parseGithubRemote("https://github.com/nyfeblade/rd-os");
      const tokenized = parseGithubRemote("https://x-access-token:ghs_testtoken@github.com/nyfeblade/rd-os.git");
      if (!ssh || ssh.full_name !== "nyfeblade/rd-os" || !https || https.full_name !== "nyfeblade/rd-os") {
        return { ok: false, error: "remote parse" };
      }
      if (!tokenized || tokenized.full_name !== "nyfeblade/rd-os") {
        return { ok: false, error: "tokenized remote parse" };
      }
      if (publicRemoteUrl("https://x-access-token:ghs_testtoken@github.com/nyfeblade/rd-os.git") !== "https://github.com/nyfeblade/rd-os.git") {
        return { ok: false, error: "publicRemoteUrl must drop credentials" };
      }
      if (CODING_DENY.indexOf("life.food") < 0 || CODING_ALLOW.indexOf("git.status") < 0) {
        return { ok: false, error: "allow/deny constants" };
      }
      return { ok: true };
    })
  );

  rows.push(
    await runCase("demo.js exists and package fence holds", () => {
      const root = path.resolve(__dirname, "..");
      for (const file of ["README.md", "package.json", "index.js", "types.d.ts", "bin/demo.js", "lib/engine.js", "lib/remote.js"]) {
        if (!fs.existsSync(path.join(root, file))) {
          return { ok: false, error: `missing ${file}` };
        }
      }
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      if (pkg.scripts.test !== "node test/run.js") {
        return { ok: false, error: "npm test script" };
      }
      const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
      if (!readme.includes("WRITE: `studio/chat-engine/**`") || !readme.includes("node bin/demo.js")) {
        return { ok: false, error: "README missing fence or demo" };
      }
      if (readme.includes("aria-label=\"Board\"") || readme.includes("Waiting home")) {
        return { ok: false, error: "README grew shell chrome" };
      }
      return { ok: true };
    })
  );

  return rows;
}

async function main() {
  const started = Date.now();
  const rows = await cases();
  const passed = rows.filter((row) => row.ok).length;
  const failed = rows.filter((row) => !row.ok);
  const wallMs = Date.now() - started;
  const packet = {
    ok: failed.length === 0,
    module: "studio/chat-engine",
    instrument: "bind.snapshot.coding_mode",
    measured_exit: failed.length === 0 ? 0 : 1,
    expect_exit: 0,
    wall_ms: wallMs,
    cases: rows.length,
    passed,
    failed: failed.length,
    clock_started: false,
    verdict: null,
    failures: failed.map((row) => ({ name: row.name, detail: row.detail })),
  };
  process.stdout.write(`${JSON.stringify(packet)}\n`);
  if (!packet.ok) {
    for (const row of failed) {
      process.stderr.write(`FAIL ${row.name}: ${row.detail}\n`);
    }
    process.stderr.write(
      `FAIL studio/chat-engine (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/chat-engine (measured; cases=${packet.cases} passed=${passed} failed=0; wall_ms=${wallMs})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`FAIL studio/chat-engine: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
