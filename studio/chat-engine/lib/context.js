"use strict";

const { ok } = require("./result");
const { CONTEXT_SCHEMA, ASSUME_SNAPSHOT_TRUTH, FENCE, PRODUCT_LOCK } = require("./codes");
const { listTools } = require("./tools");
const { listMemory } = require("./memory");
const { requireBind } = require("./snapshot");

function systemLines(mode) {
  const lines = [ASSUME_SNAPSHOT_TRUTH];
  if (mode === "coding") {
    lines.push("coding mode: use the code toolbelt only; do not offer food, flights, or life-OS");
    lines.push("prefer silent workspace tools over questions already answered by the snapshot");
  } else {
    lines.push("general mode: fuller toolbelt; project bind and workspace snapshot still apply");
  }
  return lines;
}

function buildContextPack(home, thread, snapshot, focus, nowIso) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const tools = listTools(thread.mode);
  const memory = listMemory(home, thread, {}, nowIso);
  if (!memory.ok) {
    return memory;
  }
  return ok({
    schema: CONTEXT_SCHEMA,
    fence: FENCE,
    product_lock: PRODUCT_LOCK,
    mode: thread.mode,
    thread_id: thread.id,
    bind: {
      repo_path: bound.data.repo_path,
      git_root: bound.data.git_root,
      roots: bound.data.roots.slice(),
      project_id: bound.data.project_id,
    },
    snapshot: {
      branch: snapshot.branch,
      detached: snapshot.detached,
      dirty: snapshot.dirty,
      dirty_files: snapshot.dirty_files,
      head: snapshot.head,
      head_short: snapshot.head_short,
      commits: snapshot.commits,
      captured_at: snapshot.captured_at,
      open_pr: snapshot.open_pr,
      checks: snapshot.checks,
    },
    focus,
    memory: memory.data,
    tools,
    system: systemLines(thread.mode),
    packed_at: nowIso(),
  });
}

module.exports = {
  systemLines,
  buildContextPack,
};
