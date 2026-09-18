"use strict";

const { defaultExecGit, resolveGitRoot } = require("../../chat-engine");
const { ok, REPO_BIND_SCHEMA } = require("./codes");

function bindInfo(input) {
  const requested = input && input.cwd ? String(input.cwd) : process.cwd();
  const resolved = resolveGitRoot(requested, defaultExecGit);
  if (!resolved.ok) {
    return resolved;
  }
  const gitRoot = resolved.data.git_root;
  const branchRan = defaultExecGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: gitRoot });
  const headRan = defaultExecGit(["rev-parse", "HEAD"], { cwd: gitRoot });
  const branchName = branchRan.ok ? String(branchRan.stdout || "").trim() : "";
  const detached = !branchName || branchName === "HEAD";
  const head = headRan.ok ? String(headRan.stdout || "").trim() || null : null;
  return ok({
    schema: REPO_BIND_SCHEMA,
    bound: true,
    requested: resolved.data.requested,
    toplevel: gitRoot,
    git_root: gitRoot,
    branch: detached ? null : branchName,
    detached,
    head,
    head_short: head ? head.slice(0, 12) : null,
  });
}

module.exports = {
  bindInfo,
};
