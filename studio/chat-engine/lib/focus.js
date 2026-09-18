"use strict";

const { ok, reject, isObject, isNonEmptyString } = require("./result");
const { FOCUS_SOURCES } = require("./codes");
const { confine } = require("./fsutil");
const { inferLastTouched } = require("./git");
const { requireBind } = require("./snapshot");

function normalizeSource(source) {
  if (!source) {
    return "explicit";
  }
  if (FOCUS_SOURCES.indexOf(source) < 0) {
    return null;
  }
  return source;
}

function setFocus(thread, pointer, nowIso) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  if (!isObject(pointer) || !isNonEmptyString(pointer.path)) {
    return reject("BAD_ARGUMENT", "focus.path is required");
  }
  const confined = confine(bound.data.git_root, pointer.path);
  if (!confined.ok) {
    return confined;
  }
  const source = normalizeSource(pointer.source);
  if (!source) {
    return reject("BAD_ARGUMENT", `focus.source must be one of ${FOCUS_SOURCES.join(", ")}`);
  }
  const line = Number.isFinite(pointer.line) ? Math.floor(pointer.line) : null;
  const column = Number.isFinite(pointer.column) ? Math.floor(pointer.column) : null;
  const endLine = Number.isFinite(pointer.end_line) ? Math.floor(pointer.end_line) : null;
  const endColumn = Number.isFinite(pointer.end_column) ? Math.floor(pointer.end_column) : null;
  return ok({
    path: confined.data.rel,
    abs_path: confined.data.abs,
    line,
    column,
    end_line: endLine,
    end_column: endColumn,
    source,
    updated_at: nowIso(),
  });
}

function inferFocus(thread, snapshot, execGit, nowIso) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const inferred = inferLastTouched(bound.data.git_root, snapshot, execGit);
  if (!inferred) {
    return ok(null);
  }
  return setFocus(thread, { path: inferred, source: "last_touched" }, nowIso);
}

module.exports = {
  setFocus,
  inferFocus,
};
