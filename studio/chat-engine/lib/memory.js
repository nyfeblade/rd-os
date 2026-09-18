"use strict";

const { ok, reject, isNonEmptyString } = require("./result");
const { MEMORY_KINDS } = require("./codes");
const { memoryId } = require("./ids");
const {
  loadThreadMemory,
  saveThreadMemory,
  loadProjectMemory,
  saveProjectMemory,
} = require("./store");
const { requireBind } = require("./snapshot");

function normalizeScope(scope) {
  if (!scope || scope === "thread") {
    return "thread";
  }
  if (scope === "project") {
    return "project";
  }
  return null;
}

function writeMemory(home, thread, input, nowIso) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const scope = normalizeScope(input && input.scope);
  if (!scope) {
    return reject("BAD_ARGUMENT", "memory.scope must be thread or project");
  }
  const kind = input && input.kind;
  if (MEMORY_KINDS.indexOf(kind) < 0) {
    return reject("UNKNOWN_MEMORY_KIND", `kind must be one of ${MEMORY_KINDS.join(", ")}`);
  }
  if (!isNonEmptyString(input.text)) {
    return reject("BAD_ARGUMENT", "memory.text is required");
  }
  const paths = Array.isArray(input.paths) ? input.paths.filter((row) => isNonEmptyString(row)) : [];
  const entry = {
    id: memoryId(),
    scope,
    kind,
    text: String(input.text).trim(),
    paths,
    created_at: nowIso(),
    thread_id: thread.id,
  };
  if (scope === "thread") {
    const current = loadThreadMemory(home, thread.id, nowIso);
    if (!current.ok) {
      return current;
    }
    const saved = saveThreadMemory(home, thread.id, current.data.entries.concat([entry]), nowIso);
    if (!saved.ok) {
      return saved;
    }
    return ok(entry);
  }
  const current = loadProjectMemory(home, bound.data.project_id, nowIso);
  if (!current.ok) {
    return current;
  }
  const saved = saveProjectMemory(home, bound.data.project_id, current.data.entries.concat([entry]), nowIso);
  if (!saved.ok) {
    return saved;
  }
  return ok(entry);
}

function listMemory(home, thread, query, nowIso) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const scope = query && query.scope ? normalizeScope(query.scope) : null;
  if (query && query.scope && !scope) {
    return reject("BAD_ARGUMENT", "memory.scope must be thread or project");
  }
  const threadDoc = loadThreadMemory(home, thread.id, nowIso);
  if (!threadDoc.ok) {
    return threadDoc;
  }
  const projectDoc = loadProjectMemory(home, bound.data.project_id, nowIso);
  if (!projectDoc.ok) {
    return projectDoc;
  }
  if (scope === "thread") {
    return ok({ thread: threadDoc.data.entries, project: [] });
  }
  if (scope === "project") {
    return ok({ thread: [], project: projectDoc.data.entries });
  }
  return ok({ thread: threadDoc.data.entries, project: projectDoc.data.entries });
}

module.exports = {
  writeMemory,
  listMemory,
};
