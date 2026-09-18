"use strict";

const { ok, reject, isNonEmptyString } = require("./result");
const { resolveGitRoot } = require("./git");
const { projectKey } = require("./ids");

function uniqueRoots(roots) {
  const seen = new Set();
  const out = [];
  for (const root of roots) {
    if (!seen.has(root)) {
      seen.add(root);
      out.push(root);
    }
  }
  return out;
}

function resolveBind(input, execGit) {
  const repo = isNonEmptyString(input && input.repo) ? input.repo : input && input.path;
  if (!isNonEmptyString(repo)) {
    return reject("UNBOUND_THREAD", "every thread must bind a project/repo");
  }
  const primary = resolveGitRoot(repo, execGit);
  if (!primary.ok) {
    return primary;
  }
  const extras = Array.isArray(input.roots) ? input.roots : [];
  const resolved = [primary.data.git_root];
  for (const extra of extras) {
    const next = resolveGitRoot(extra, execGit);
    if (!next.ok) {
      return next;
    }
    resolved.push(next.data.git_root);
  }
  const roots = uniqueRoots(resolved);
  return ok({
    repo_path: primary.data.requested,
    git_root: primary.data.git_root,
    roots,
    project_id: projectKey(primary.data.git_root),
  });
}

module.exports = {
  resolveBind,
};
