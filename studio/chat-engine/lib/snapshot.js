"use strict";

const { ok, reject, isObject } = require("./result");
const { captureRoot } = require("./git");
const { parseGithubRemote } = require("./github");
const { DEFAULT_COMMIT_COUNT } = require("./codes");

function requireBind(thread) {
  if (!isObject(thread) || !isObject(thread.bind) || !thread.bind.git_root) {
    return reject("UNBOUND_THREAD", "thread has no project/repo bind");
  }
  return ok(thread.bind);
}

async function refreshSnapshot(thread, deps) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const commitCount = deps && Number.isFinite(deps.commitCount) ? deps.commitCount : DEFAULT_COMMIT_COUNT;
  const execGit = deps.execGit;
  const capturedAt = deps.nowIso();
  const roots = Array.isArray(bound.data.roots) && bound.data.roots.length > 0 ? bound.data.roots : [bound.data.git_root];
  const captured = roots.map((root) => captureRoot(root, execGit, commitCount));
  const primary = captured[0];
  const remote = parseGithubRemote(primary.remote_url);
  let openPr = null;
  let checks = null;
  if (deps.github && remote && primary.branch) {
    const pr = await deps.github.readPrForBranch({
      owner: remote.owner,
      repo: remote.repo,
      branch: primary.branch,
    });
    if (pr && pr.ok && pr.data) {
      openPr = pr.data;
      const sha = openPr.head || primary.head;
      const ci = await deps.github.readChecks({
        owner: remote.owner,
        repo: remote.repo,
        sha,
      });
      if (ci && ci.ok && ci.data) {
        checks = ci.data;
      }
    }
  }
  return ok({
    repo_path: bound.data.repo_path,
    git_root: primary.git_root,
    project_id: bound.data.project_id,
    empty: primary.empty,
    detached: primary.detached,
    branch: primary.branch,
    head: primary.head,
    head_short: primary.head_short,
    dirty: primary.dirty,
    dirty_files: primary.dirty_files,
    commits: primary.commits,
    remote_url: primary.remote_url,
    github: remote,
    open_pr: openPr,
    checks,
    roots: captured,
    captured_at: capturedAt,
  });
}

module.exports = {
  requireBind,
  refreshSnapshot,
};
