"use strict";

/**
 * Consume-only chat-engine bridge. Shell owns chrome; the engine owns bind,
 * snapshot, memory, focus, and persist. Do not copy bind/snapshot/git.
 */

const fs = require("node:fs");
const path = require("node:path");
const { createChatEngine } = require("../../chat-engine");

const ENGINE_REL = "studio/chat-engine";
const PREFS_NAME = "shell-bind.json";
const DEFAULT_MODE = "coding";
const CODE_FOCUS_CANDIDATES = Object.freeze([
  "studio/shell/README.md",
  "studio/shell/package.json",
  "README.md",
  "package.json",
]);

function defaultRepoPath() {
  if (process.env.STUDIO_REPO) {
    return path.resolve(process.env.STUDIO_REPO);
  }
  return path.resolve(__dirname, "..", "..", "..");
}

function defaultVarDir() {
  return path.resolve(__dirname, "..", "var");
}

function resolvePaths(options) {
  const opts = options || {};
  const varDir = opts.varDir ? path.resolve(opts.varDir) : defaultVarDir();
  const home = opts.home
    ? path.resolve(opts.home)
    : process.env.CHAT_ENGINE_HOME
      ? path.resolve(process.env.CHAT_ENGINE_HOME)
      : path.join(varDir, "chat-engine");
  const prefs = opts.prefsPath ? path.resolve(opts.prefsPath) : path.join(varDir, PREFS_NAME);
  return { home, prefs, varDir };
}

function emptyCurrent(home) {
  return {
    ok: false,
    code: "UNBOUND_THREAD",
    detail: "chat is not bound to a repo",
    home,
    thread: null,
    snapshot: null,
    pack: null,
    memory: { thread: [], project: [] },
    events: [],
  };
}

function readPrefs(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data !== "object") {
      return null;
    }
    const repo = typeof data.repo === "string" && data.repo.trim() ? data.repo.trim() : null;
    const threadId = typeof data.thread_id === "string" && data.thread_id.trim() ? data.thread_id.trim() : null;
    if (!repo) {
      return null;
    }
    return { repo, thread_id: threadId };
  } catch (_err) {
    return null;
  }
}

function writePrefs(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}`, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function repoLabel(gitRoot) {
  if (!gitRoot) {
    return "";
  }
  return path.basename(gitRoot);
}

function dirtyLabel(snapshot) {
  if (!snapshot || typeof snapshot.dirty !== "boolean") {
    return "";
  }
  return snapshot.dirty ? "dirty" : "clean";
}

function branchLabel(snapshot) {
  if (!snapshot) {
    return "";
  }
  if (snapshot.branch) {
    return snapshot.branch;
  }
  if (snapshot.detached) {
    return "detached";
  }
  return "";
}

function chromeFromSnapshot(current) {
  const bind = current.thread && current.thread.bind;
  const snap = current.snapshot;
  const gitRoot = (snap && snap.git_root) || (bind && bind.git_root) || "";
  return {
    repo: repoLabel(gitRoot),
    branch: branchLabel(snap),
    dirty: dirtyLabel(snap),
    head_short: snap && snap.head_short ? snap.head_short : "",
    git_root: gitRoot,
    mode: current.pack && current.pack.mode ? current.pack.mode : "",
  };
}

function transcriptFromEngine(current) {
  const rows = [];
  if (current.pack && Array.isArray(current.pack.system) && current.pack.system[0]) {
    rows.push({
      id: "engine-system",
      who: "Studio",
      body: current.pack.system[0],
      me: false,
      at: current.thread && current.thread.created_at ? current.thread.created_at : "0",
      kind: "system",
    });
  }
  const notes = current.memory && Array.isArray(current.memory.thread) ? current.memory.thread : [];
  for (const entry of notes) {
    rows.push({
      id: entry.id,
      who: entry.kind === "note" ? "You" : "Studio",
      body: entry.text,
      me: entry.kind === "note",
      at: entry.created_at,
      kind: entry.kind || "note",
    });
  }
  const events = Array.isArray(current.events) ? current.events : [];
  for (const event of events) {
    rows.push({
      id: event.id,
      who: event.source || "engine",
      body: event.summary,
      me: false,
      at: event.created_at,
      kind: "outcome",
    });
  }
  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
  return rows;
}

function slimSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }
  return {
    repo_path: snapshot.repo_path,
    git_root: snapshot.git_root,
    branch: snapshot.branch,
    detached: snapshot.detached,
    dirty: snapshot.dirty,
    dirty_count: Array.isArray(snapshot.dirty_files) ? snapshot.dirty_files.length : 0,
    head: snapshot.head,
    head_short: snapshot.head_short,
    captured_at: snapshot.captured_at,
  };
}

function slimPack(pack) {
  if (!pack) {
    return null;
  }
  return {
    system: pack.system,
    mode: pack.mode,
    packed_at: pack.packed_at,
    tools: pack.tools,
  };
}

function serialize(current) {
  return {
    ok: current.ok === true,
    code: current.code || null,
    detail: current.detail || null,
    home: current.home,
    engine: ENGINE_REL,
    thread: current.thread,
    snapshot: slimSnapshot(current.snapshot),
    pack: slimPack(current.pack),
    memory: current.memory,
    events: current.events,
    messages: transcriptFromEngine(current),
    chrome: chromeFromSnapshot(current),
    focus: current.thread && current.thread.focus ? current.thread.focus : null,
  };
}

function pickRepo(explicit, paths, fallbackRepo) {
  if (typeof explicit === "string" && explicit.trim()) {
    return path.resolve(explicit.trim());
  }
  if (typeof fallbackRepo === "string" && fallbackRepo.trim()) {
    return path.resolve(fallbackRepo.trim());
  }
  const prefs = readPrefs(paths.prefs);
  if (prefs && prefs.repo && fs.existsSync(prefs.repo)) {
    return prefs.repo;
  }
  return defaultRepoPath();
}

function latestMatchingThread(engine, projectId) {
  const listed = engine.threads.list();
  if (!listed.ok) {
    return listed;
  }
  const matches = listed.data.threads.filter((thread) => thread.bind && thread.bind.project_id === projectId);
  matches.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  if (!matches[0]) {
    return { ok: true, data: null };
  }
  return engine.threads.get(matches[0].id);
}

function restoreOrOpen(engine, repo, prefs) {
  const resolved = engine.bind.resolve(repo);
  if (!resolved.ok) {
    return resolved;
  }
  if (prefs && prefs.thread_id) {
    const remembered = engine.threads.get(prefs.thread_id);
    if (remembered.ok && remembered.data.thread.bind.project_id === resolved.data.project_id) {
      return remembered;
    }
  }
  const existing = latestMatchingThread(engine, resolved.data.project_id);
  if (!existing.ok) {
    return existing;
  }
  if (existing.data) {
    return existing;
  }
  return engine.threads.open({ repo: resolved.data.git_root, mode: DEFAULT_MODE });
}

function pickCodeFocusPath(gitRoot) {
  for (const rel of CODE_FOCUS_CANDIDATES) {
    if (fs.existsSync(path.join(gitRoot, rel))) {
      return rel;
    }
  }
  return null;
}

function createChatSession(options) {
  const opts = options || {};
  const paths = resolvePaths(opts);
  const persistPrefs = opts.persistPrefs !== false;
  const engineOpts = opts.engine && typeof opts.engine === "object" ? opts.engine : {};
  const engine = createChatEngine({ home: paths.home, ...engineOpts });
  let current = emptyCurrent(paths.home);
  let queue = Promise.resolve();

  function runExclusive(fn) {
    const next = queue.then(fn, fn);
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  function fail(code, detail) {
    current = {
      ...current,
      ok: false,
      code,
      detail,
      home: paths.home,
    };
    return { ok: false, code, detail, state: serialize(current) };
  }

  function succeed() {
    current = {
      ...current,
      ok: true,
      code: null,
      detail: null,
      home: paths.home,
    };
    return { ok: true, state: serialize(current) };
  }

  async function hydrate(thread) {
    const memory = engine.memory.list(thread.id);
    const events = engine.outcomes.list(thread.id);
    current.thread = thread;
    current.memory = memory.ok ? memory.data : { thread: [], project: [] };
    current.events = events.ok ? events.data : [];
    const packed = await engine.context.pack(thread.id);
    if (!packed.ok) {
      current.snapshot = null;
      current.pack = null;
      current.thread = thread;
      return fail(packed.code, packed.detail);
    }
    current.thread = packed.data.thread;
    current.snapshot = packed.data.snapshot;
    current.pack = packed.data.pack;
    if (persistPrefs) {
      writePrefs(paths.prefs, {
        repo: packed.data.thread.bind.git_root,
        thread_id: packed.data.thread.id,
        bound_at: packed.data.thread.bind.bound_at,
      });
    }
    return succeed();
  }

  async function bindNow(repoPath) {
    const repo = pickRepo(repoPath, paths, opts.repo);
    const prefs = persistPrefs ? readPrefs(paths.prefs) : null;
    const opened = restoreOrOpen(engine, repo, prefs);
    if (!opened.ok) {
      current = emptyCurrent(paths.home);
      return fail(opened.code, opened.detail);
    }
    return hydrate(opened.data.thread);
  }

  async function refreshNow() {
    if (!current.thread) {
      return fail("UNBOUND_THREAD", "chat is not bound to a repo");
    }
    return hydrate(current.thread);
  }

  async function sendNow(text) {
    if (!current.thread) {
      return fail("UNBOUND_THREAD", "chat is not bound to a repo");
    }
    if (typeof text !== "string" || !text.trim()) {
      return fail("BAD_ARGUMENT", "message is empty");
    }
    const written = engine.memory.write(current.thread.id, {
      scope: "thread",
      kind: "note",
      text: text.trim(),
    });
    if (!written.ok) {
      return fail(written.code, written.detail);
    }
    const hydrated = await hydrate(current.thread);
    if (!hydrated.ok) {
      return hydrated;
    }
    return { ok: true, entry: written.data, state: serialize(current) };
  }

  async function setCodeFocusNow(open) {
    if (open !== true && open !== false) {
      return fail("BAD_ARGUMENT", "focus open must be true or false");
    }
    if (!current.thread) {
      return fail("UNBOUND_THREAD", "chat is not bound to a repo");
    }
    if (open === false) {
      return succeed();
    }
    const rel = pickCodeFocusPath(current.thread.bind.git_root);
    if (!rel) {
      return fail("BAD_ARGUMENT", "no in-repo path for Code focus");
    }
    const focused = engine.focus.set(current.thread.id, { path: rel, source: "code" });
    if (!focused.ok) {
      return fail(focused.code, focused.detail);
    }
    current.thread = focused.data.thread;
    return succeed();
  }

  return {
    engine,
    home: paths.home,
    bind(repoPath) {
      return runExclusive(() => bindNow(repoPath));
    },
    refresh() {
      return runExclusive(() => refreshNow());
    },
    send(text) {
      return runExclusive(() => sendNow(text));
    },
    setCodeFocus(open) {
      return runExclusive(() => setCodeFocusNow(open));
    },
    state() {
      return serialize(current);
    },
  };
}

function describeChrome(chrome) {
  if (!chrome || !chrome.repo) {
    return "";
  }
  const parts = [chrome.repo];
  if (chrome.branch) {
    parts.push(chrome.branch);
  }
  if (chrome.dirty) {
    parts.push(chrome.dirty);
  }
  return parts.join(" · ");
}

module.exports = {
  ENGINE_REL,
  CODE_FOCUS_CANDIDATES,
  createChatSession,
  defaultRepoPath,
  defaultVarDir,
  resolvePaths,
  chromeFromSnapshot,
  transcriptFromEngine,
  describeChrome,
  serialize,
};
