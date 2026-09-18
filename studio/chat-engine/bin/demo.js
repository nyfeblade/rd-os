#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createChatEngine,
  FENCE,
  PRODUCT_LOCK,
  ASSUME_SNAPSHOT_TRUTH,
  DEFAULT_MODE,
} = require("..");

function parseArgs(argv) {
  const out = { json: false, home: null, repo: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      out.json = true;
    } else if (arg === "--home") {
      out.home = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      out.help = true;
    } else if (!arg.startsWith("-")) {
      rest.push(arg);
    } else {
      out.unknown = arg;
    }
  }
  out.repo = rest[0] || process.cwd();
  return out;
}

function usage() {
  return [
    "studio/chat-engine demo — bind a local repo, print live snapshot + coding-mode pack",
    "",
    "  node bin/demo.js [--json] [--home <dir>] [repo]",
    "",
    "repo defaults to cwd (git toplevel is resolved). No paste. No dashboard.",
  ].join("\n");
}

function line(label, value) {
  const pad = label.padEnd(10, " ");
  return `${pad}${value}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (args.unknown) {
    process.stderr.write(`unknown flag ${args.unknown}\n${usage()}\n`);
    return 2;
  }

  const home = args.home
    ? path.resolve(args.home)
    : fs.mkdtempSync(path.join(os.tmpdir(), "studio-chat-engine-"));
  const engine = createChatEngine({ home });
  const opened = engine.threads.open({ repo: args.repo, mode: DEFAULT_MODE });
  if (!opened.ok) {
    process.stderr.write(`FAIL bind ${opened.code}: ${opened.detail}\n`);
    return 1;
  }
  const threadId = opened.data.thread.id;

  engine.memory.write(threadId, {
    scope: "thread",
    kind: "attempt",
    text: "demo: bound without paste",
  });
  engine.memory.write(threadId, {
    scope: "project",
    kind: "decision",
    text: "assume snapshot truth; do not ask for branch/diff paste",
  });

  const packed = await engine.context.pack(threadId);
  if (!packed.ok) {
    process.stderr.write(`FAIL pack ${packed.code}: ${packed.detail}\n`);
    return 1;
  }

  const denied = engine.tools.authorize(threadId, "life.food");
  const browse = engine.tools.authorize(threadId, "web.browse");
  const gitStatus = engine.tools.authorize(threadId, "git.status");

  const played = await engine.handoff.play(threadId, {
    target: "cursor_ca",
    brief: "fix the failing check",
    dry_run: true,
  });
  if (!played.ok) {
    process.stderr.write(`FAIL handoff ${played.code}: ${played.detail}\n`);
    return 1;
  }

  engine.outcomes.ingest(threadId, {
    source: "ci",
    status: "failure",
    ref: packed.data.snapshot.head_short,
    summary: "stub CI failure ingested into thread",
  });

  const reopened = createChatEngine({ home });
  const memory = reopened.memory.list(threadId);
  const events = reopened.outcomes.list(threadId);
  const snap = packed.data.snapshot;
  const pack = packed.data.pack;
  const focus = packed.data.thread.focus;

  const report = {
    fence: FENCE,
    product_lock: PRODUCT_LOCK,
    home,
    thread: threadId,
    bind: {
      repo_path: opened.data.thread.bind.repo_path,
      git_root: opened.data.thread.bind.git_root,
      project_id: opened.data.thread.bind.project_id,
    },
    snapshot: {
      branch: snap.branch,
      detached: snap.detached,
      dirty: snap.dirty,
      dirty_files: snap.dirty_files.map((row) => row.path),
      head: snap.head,
      head_short: snap.head_short,
      commits: snap.commits.map((row) => `${row.sha.slice(0, 12)} ${row.subject}`),
      captured_at: snap.captured_at,
      open_pr: snap.open_pr,
    },
    focus: focus
      ? { path: focus.path, source: focus.source, line: focus.line }
      : null,
    mode: pack.mode,
    tools: {
      allow: pack.tools.allow,
      deny: pack.tools.deny,
    },
    authorize: {
      "git.status": gitStatus.ok,
      "web.browse": browse.ok,
      "life.food": denied.ok ? true : denied.code,
    },
    system: pack.system,
    assume_snapshot_truth: pack.system.includes(ASSUME_SNAPSHOT_TRUTH),
    handoff: {
      target: played.data.target,
      mode: played.data.mode,
      snapshot_head: played.data.payload.snapshot.head,
      snapshot_branch: played.data.payload.snapshot.branch,
    },
    memory_reopen: memory.ok
      ? { thread: memory.data.thread.length, project: memory.data.project.length }
      : { error: memory.code },
    outcomes_reopen: events.ok ? events.data.length : 0,
    chrome: "not-owned",
    dashboard: false,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  const dirtyLabel = snap.dirty ? `dirty (${snap.dirty_files.length})` : "clean";
  const lines = [
    "studio/chat-engine  demo",
    line("fence", FENCE),
    line("thread", threadId),
    line("bound", opened.data.thread.bind.git_root),
    line("branch", snap.branch || (snap.detached ? "(detached)" : "(empty)")),
    line("dirty", dirtyLabel),
    line("head", snap.head_short || "(none)"),
    line("commits", String(snap.commits.length)),
    line("focus", focus ? `${focus.path} (${focus.source})` : "(none)"),
    line("mode", pack.mode),
    line("allow", pack.tools.allow.join(" ")),
    line("deny", pack.tools.deny.join(" ")),
    line("system", ASSUME_SNAPSHOT_TRUTH),
    line("life.food", denied.ok ? "ALLOWED (bug)" : denied.code),
    line("handoff", `${played.data.mode} ${played.data.target} head=${played.data.payload.snapshot.head_short}`),
    line("memory", `thread=${report.memory_reopen.thread} project=${report.memory_reopen.project} (survived reopen)`),
    line("outcomes", String(report.outcomes_reopen)),
    line("shell", "not this PR — Chat header later reads snapshot.branch / dirty / head"),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    process.stderr.write(`FAIL demo: ${err && err.message ? err.message : String(err)}\n`);
    process.exit(1);
  });
