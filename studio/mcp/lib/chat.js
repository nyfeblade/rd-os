"use strict";

const os = require("os");
const path = require("path");
const { createChatEngine, ASSUME_SNAPSHOT_TRUTH, PRODUCT_LOCK } = require("../../chat-engine");
const { ok, CHAT_SNAPSHOT_SCHEMA } = require("./codes");

function createChatSurface(options) {
  const opts = options || {};
  const engine =
    opts.chatEngine ||
    createChatEngine({
      home: opts.chatHome,
      clock: opts.clock,
      github: opts.github,
      env: opts.env,
    });
  const defaultRepo = opts.repo || process.cwd();
  let cachedThreadId = null;

  function openBound(repo) {
    const opened = engine.threads.open({ repo });
    if (!opened.ok) {
      return opened;
    }
    cachedThreadId = opened.data.thread.id;
    return opened;
  }

  function resolveThreadId(args) {
    if (args && args.thread_id) {
      const loaded = engine.threads.get(String(args.thread_id));
      if (!loaded.ok) {
        return loaded;
      }
      cachedThreadId = loaded.data.thread.id;
      return ok({ thread_id: cachedThreadId, thread: loaded.data.thread });
    }
    if (cachedThreadId) {
      const loaded = engine.threads.get(cachedThreadId);
      if (loaded.ok) {
        return ok({ thread_id: cachedThreadId, thread: loaded.data.thread });
      }
    }
    const repo = args && args.repo ? String(args.repo) : defaultRepo;
    const listed = engine.threads.list();
    if (listed.ok) {
      const bind = engine.bind.resolve({ repo });
      if (bind.ok) {
        const match = listed.data.threads.find((thread) => thread.bind && thread.bind.git_root === bind.data.git_root);
        if (match) {
          cachedThreadId = match.id;
          return ok({ thread_id: match.id, thread: match });
        }
      }
    }
    const opened = openBound(repo);
    if (!opened.ok) {
      return opened;
    }
    return ok({ thread_id: opened.data.thread.id, thread: opened.data.thread });
  }

  async function snapshot(args) {
    const resolved = resolveThreadId(args || {});
    if (!resolved.ok) {
      return resolved;
    }
    const refreshed = await engine.snapshot.refresh(resolved.data.thread_id);
    if (!refreshed.ok) {
      return refreshed;
    }
    const snap = refreshed.data.snapshot;
    return ok({
      schema: CHAT_SNAPSHOT_SCHEMA,
      stub: false,
      source: "studio/chat-engine",
      thread_id: resolved.data.thread_id,
      bind: {
        repo_path: snap.repo_path,
        git_root: snap.git_root,
        project_id: snap.project_id,
      },
      snapshot: {
        branch: snap.branch,
        detached: snap.detached,
        dirty: snap.dirty,
        dirty_files: snap.dirty_files,
        head: snap.head,
        head_short: snap.head_short,
        commits: snap.commits,
        captured_at: snap.captured_at,
        open_pr: snap.open_pr,
        checks: snap.checks,
      },
      assume_snapshot_truth: ASSUME_SNAPSHOT_TRUTH,
      product_lock: PRODUCT_LOCK,
    });
  }

  return {
    engine,
    snapshot,
    defaultRepo,
    home: engine.home,
  };
}

function defaultChatHome(studioHome) {
  if (process.env.CHAT_ENGINE_HOME) {
    return path.resolve(process.env.CHAT_ENGINE_HOME);
  }
  if (studioHome) {
    return path.join(path.resolve(studioHome), "chat-engine");
  }
  return path.join(os.tmpdir(), "studio-mcp-chat");
}

module.exports = {
  createChatSurface,
  defaultChatHome,
};
