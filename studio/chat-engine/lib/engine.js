"use strict";

const path = require("path");
const { ok, reject, isNonEmptyString } = require("./result");
const {
  SCHEMA,
  THREAD_SCHEMA,
  FENCE,
  PRODUCT_LOCK,
  DEFAULT_MODE,
  DEFAULT_COMMIT_COUNT,
  shellHints,
} = require("./codes");
const { threadId, projectKey } = require("./ids");
const { defaultExecGit } = require("./git");
const { createGithubReader } = require("./github");
const { resolveBind } = require("./bind");
const { refreshSnapshot } = require("./snapshot");
const { setFocus, inferFocus } = require("./focus");
const { writeMemory, listMemory } = require("./memory");
const { normalizeMode, authorizeTool, listTools, invokeTool } = require("./tools");
const { buildContextPack } = require("./context");
const { playHandoff } = require("./handoff");
const { ingestOutcome, listOutcomes, pollOutcomes } = require("./outcomes");
const { ensureHome, saveThread, loadThread, listThreadIds, saveProject } = require("./store");

function resolveHome(options) {
  if (options && isNonEmptyString(options.home)) {
    return path.resolve(options.home);
  }
  if (process.env.CHAT_ENGINE_HOME) {
    return path.resolve(process.env.CHAT_ENGINE_HOME);
  }
  return path.join(process.cwd(), "var", "chat-engine");
}

function createClock(options) {
  if (options && typeof options.clock === "function") {
    return options.clock;
  }
  return () => Date.now();
}

function createChatEngine(options) {
  const opts = options || {};
  const home = resolveHome(opts);
  const clock = createClock(opts);
  const nowIso = () => new Date(clock()).toISOString();
  const execGit = opts.execGit || defaultExecGit;
  const github = createGithubReader(opts.github || { fetch: opts.fetch, env: opts.env });
  const commitCount = Number.isFinite(opts.commitCount) ? opts.commitCount : DEFAULT_COMMIT_COUNT;
  ensureHome(home, nowIso);

  function load(id) {
    return loadThread(home, id);
  }

  function persist(thread) {
    thread.updated_at = nowIso();
    return saveThread(home, thread);
  }

  async function snapshotOf(thread) {
    return refreshSnapshot(thread, { execGit, github, nowIso, commitCount });
  }

  function rememberProject(bind, createdAt) {
    return saveProject(home, {
      id: bind.project_id,
      git_root: bind.git_root,
      repo_path: bind.repo_path,
      roots: bind.roots.slice(),
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  function openThread(input) {
    const bound = resolveBind(input || {}, execGit);
    if (!bound.ok) {
      return bound;
    }
    const mode = normalizeMode(input && input.mode);
    if ((input && input.mode) && !mode) {
      return reject("UNKNOWN_MODE", "mode must be coding or general");
    }
    const createdAt = nowIso();
    const thread = {
      schema: THREAD_SCHEMA,
      id: threadId(),
      created_at: createdAt,
      updated_at: createdAt,
      mode: mode || DEFAULT_MODE,
      bind: {
        repo_path: bound.data.repo_path,
        git_root: bound.data.git_root,
        roots: bound.data.roots.slice(),
        project_id: bound.data.project_id,
        bound_at: createdAt,
      },
      focus: null,
      last_handoff_id: null,
      poll_fingerprint: null,
    };
    if (input && input.focus) {
      const focused = setFocus(thread, input.focus, nowIso);
      if (!focused.ok) {
        return focused;
      }
      thread.focus = focused.data;
    }
    rememberProject(bound.data, createdAt);
    const saved = persist(thread);
    if (!saved.ok) {
      return saved;
    }
    return ok({ thread: saved.data });
  }

  function getThread(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return ok({ thread: loaded.data });
  }

  function listThreads() {
    const ids = listThreadIds(home);
    const threads = [];
    for (const id of ids) {
      const loaded = load(id);
      if (loaded.ok) {
        threads.push(loaded.data);
      }
    }
    return ok({ threads });
  }

  async function refresh(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    const snapshot = await snapshotOf(loaded.data);
    if (!snapshot.ok) {
      return snapshot;
    }
    if (!loaded.data.focus) {
      const inferred = inferFocus(loaded.data, snapshot.data, execGit, nowIso);
      if (inferred.ok && inferred.data) {
        loaded.data.focus = inferred.data;
        persist(loaded.data);
      }
    }
    return ok({ thread: loaded.data, snapshot: snapshot.data });
  }

  function setThreadFocus(id, pointer) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    const focused = setFocus(loaded.data, pointer, nowIso);
    if (!focused.ok) {
      return focused;
    }
    loaded.data.focus = focused.data;
    persist(loaded.data);
    return ok({ thread: loaded.data, focus: focused.data });
  }

  function getFocus(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return ok({ focus: loaded.data.focus });
  }

  function clearFocus(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    loaded.data.focus = null;
    persist(loaded.data);
    return ok({ thread: loaded.data, focus: null });
  }

  function writeThreadMemory(id, input) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return writeMemory(home, loaded.data, input, nowIso);
  }

  function listThreadMemory(id, query) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return listMemory(home, loaded.data, query || {}, nowIso);
  }

  function getMode(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return ok({ mode: loaded.data.mode, tools: listTools(loaded.data.mode) });
  }

  function setMode(id, mode) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    const resolved = normalizeMode(mode);
    if (!resolved) {
      return reject("UNKNOWN_MODE", "mode must be coding or general");
    }
    loaded.data.mode = resolved;
    persist(loaded.data);
    return ok({ mode: resolved, tools: listTools(resolved) });
  }

  async function pack(id) {
    const refreshed = await refresh(id);
    if (!refreshed.ok) {
      return refreshed;
    }
    const packed = buildContextPack(home, refreshed.data.thread, refreshed.data.snapshot, refreshed.data.thread.focus, nowIso);
    if (!packed.ok) {
      return packed;
    }
    return ok({
      thread: refreshed.data.thread,
      snapshot: refreshed.data.snapshot,
      pack: packed.data,
    });
  }

  async function invoke(id, toolId, args) {
    const refreshed = await refresh(id);
    if (!refreshed.ok) {
      return refreshed;
    }
    return invokeTool(refreshed.data.thread, refreshed.data.snapshot, toolId, args || {}, {
      github,
      playHandoff: (threadId, input) => play(threadId, input),
    });
  }

  function authorize(id, toolId, args) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return authorizeTool(loaded.data.mode, toolId, args);
  }

  async function play(id, input) {
    const packed = await pack(id);
    if (!packed.ok) {
      return packed;
    }
    const played = await playHandoff(
      home,
      packed.data.thread,
      packed.data.snapshot,
      packed.data.thread.focus,
      packed.data.pack,
      input || {},
      { nowIso, adapters: opts.adapters }
    );
    if (!played.ok) {
      return played;
    }
    packed.data.thread.last_handoff_id = played.data.receipt.id;
    persist(packed.data.thread);
    return played;
  }

  function ingest(id, input) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return ingestOutcome(home, loaded.data, input || {}, nowIso);
  }

  async function poll(id) {
    const refreshed = await refresh(id);
    if (!refreshed.ok) {
      return refreshed;
    }
    const polled = await pollOutcomes(home, refreshed.data.thread, refreshed.data.snapshot, nowIso);
    if (!polled.ok) {
      return polled;
    }
    refreshed.data.thread.poll_fingerprint = polled.data.fingerprint;
    persist(refreshed.data.thread);
    return polled;
  }

  function outcomes(id) {
    const loaded = load(id);
    if (!loaded.ok) {
      return loaded;
    }
    return listOutcomes(home, loaded.data.id);
  }

  async function dump(id) {
    const packed = await pack(id);
    if (!packed.ok) {
      return packed;
    }
    const memory = listThreadMemory(id, {});
    const events = outcomes(id);
    return ok({
      schema: SCHEMA,
      fence: FENCE,
      product_lock: PRODUCT_LOCK,
      clock_started: false,
      verdict: null,
      shell: shellHints(),
      thread: packed.data.thread,
      snapshot: packed.data.snapshot,
      pack: packed.data.pack,
      memory: memory.ok ? memory.data : { thread: [], project: [] },
      events: events.ok ? events.data : [],
    });
  }

  return {
    home,
    threads: {
      open: openThread,
      get: getThread,
      list: listThreads,
    },
    bind: {
      resolve(input) {
        return resolveBind(typeof input === "string" ? { repo: input } : input || {}, execGit);
      },
    },
    snapshot: {
      refresh,
    },
    focus: {
      set: setThreadFocus,
      get: getFocus,
      clear: clearFocus,
    },
    memory: {
      write: writeThreadMemory,
      list: listThreadMemory,
    },
    mode: {
      get: getMode,
      set: setMode,
    },
    tools: {
      list(id) {
        if (!id) {
          return ok(listTools(DEFAULT_MODE));
        }
        return getMode(id);
      },
      authorize,
      invoke,
    },
    context: {
      pack,
    },
    handoff: {
      play,
      list: outcomes,
    },
    outcomes: {
      ingest,
      poll,
      list: outcomes,
    },
    dump,
    projectKey,
  };
}

module.exports = {
  createChatEngine,
  resolveHome,
};
