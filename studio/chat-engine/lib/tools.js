"use strict";

const fs = require("fs");
const path = require("path");
const { ok, reject, assertNever, isObject } = require("./result");
const { TOOLS, TOOL_IDS, DEFAULT_MODE, MODES } = require("./codes");
const { confine } = require("./fsutil");
const { requireBind } = require("./snapshot");

function normalizeMode(mode) {
  if (!mode) {
    return DEFAULT_MODE;
  }
  if (MODES.indexOf(mode) < 0) {
    return null;
  }
  return mode;
}

function authorizeTool(mode, toolId, args) {
  const resolved = normalizeMode(mode);
  if (!resolved) {
    return reject("UNKNOWN_MODE", "mode must be coding or general");
  }
  if (typeof toolId !== "string" || !TOOLS[toolId]) {
    return reject("UNKNOWN_TOOL", `${toolId} is not in the closed catalog`);
  }
  const tool = TOOLS[toolId];
  if (tool.family === "life") {
    return reject("LIFE_OS_DENIED", `${toolId} is life-OS and is not part of Studio`);
  }
  if (resolved === "coding") {
    if (tool.codingRequiresAsked && !(args && args.asked === true)) {
      return reject("TOOL_DENIED", "random web browse unless asked");
    }
    if (!tool.modes.includes("coding")) {
      return reject("TOOL_DENIED", `${toolId} is stripped in coding mode`);
    }
    return ok({ tool: toolId, mode: resolved, family: tool.family });
  }
  if (resolved === "general") {
    if (!tool.modes.includes("general")) {
      return reject("TOOL_DENIED", `${toolId} is not in the general toolbelt`);
    }
    return ok({ tool: toolId, mode: resolved, family: tool.family });
  }
  return assertNever(resolved, "Mode");
}

function listTools(mode) {
  const resolved = normalizeMode(mode) || DEFAULT_MODE;
  const allow = [];
  const deny = [];
  const allowIfAsked = [];
  for (const id of TOOL_IDS) {
    const tool = TOOLS[id];
    if (resolved === "coding" && tool.codingRequiresAsked) {
      allowIfAsked.push(id);
      deny.push(id);
      continue;
    }
    const allowed = authorizeTool(resolved, id, { asked: true });
    if (allowed.ok) {
      allow.push(id);
    } else {
      deny.push(id);
    }
  }
  return {
    mode: resolved,
    allow,
    allow_if_asked: allowIfAsked,
    deny,
  };
}

function readFileInside(root, rel) {
  const confined = confine(root, rel);
  if (!confined.ok) {
    return confined;
  }
  try {
    const content = fs.readFileSync(confined.data.abs, "utf8");
    return ok({ path: confined.data.rel, content, bytes: Buffer.byteLength(content) });
  } catch (err) {
    return reject("BAD_ARGUMENT", err && err.message ? err.message : String(err));
  }
}

function listInside(root, rel) {
  const confined = confine(root, rel || ".");
  if (!confined.ok) {
    return confined;
  }
  try {
    const entries = fs.readdirSync(confined.data.abs, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "dir" : "file",
      path: path.posix.join(confined.data.rel || ".", entry.name).replace(/^\.\//, ""),
    }));
    return ok({ path: confined.data.rel || ".", entries });
  } catch (err) {
    return reject("BAD_ARGUMENT", err && err.message ? err.message : String(err));
  }
}

async function invokeTool(thread, snapshot, toolId, args, deps) {
  const bound = requireBind(thread);
  if (!bound.ok) {
    return bound;
  }
  const authorized = authorizeTool(thread.mode, toolId, args);
  if (!authorized.ok) {
    return authorized;
  }
  const input = isObject(args) ? args : {};
  switch (toolId) {
    case "fs.read":
      return readFileInside(bound.data.git_root, input.path);
    case "fs.list":
      return listInside(bound.data.git_root, input.path);
    case "fs.diff":
      return ok({
        dirty: snapshot.dirty,
        dirty_files: snapshot.dirty_files,
        note: "workspace snapshot is truth — do not ask the user to paste this diff",
      });
    case "git.status":
      return ok({
        branch: snapshot.branch,
        dirty: snapshot.dirty,
        dirty_files: snapshot.dirty_files,
        head: snapshot.head,
      });
    case "git.log":
      return ok({ commits: snapshot.commits });
    case "git.show":
      return ok({ head: snapshot.head, commits: snapshot.commits.slice(0, 1) });
    case "git.diff":
      return ok({ dirty: snapshot.dirty, dirty_files: snapshot.dirty_files });
    case "git.branch":
      return ok({ branch: snapshot.branch, detached: snapshot.detached, head: snapshot.head });
    case "github.pr.read":
      return ok({ open_pr: snapshot.open_pr, github: snapshot.github });
    case "github.ci.read":
      return ok({ checks: snapshot.checks, open_pr: snapshot.open_pr });
    case "github.review.read": {
      if (!deps.github || !snapshot.github || !snapshot.open_pr) {
        return ok({ threads: [], mode: "stub" });
      }
      return deps.github.readReviews({
        owner: snapshot.github.owner,
        repo: snapshot.github.repo,
        number: snapshot.open_pr.number,
      });
    }
    case "handoff.cursor_ca":
      return deps.playHandoff(thread.id, { target: "cursor_ca", brief: input.brief || "", dry_run: true });
    case "handoff.claude_code":
      return deps.playHandoff(thread.id, { target: "claude_code", brief: input.brief || "", dry_run: true });
    case "test.run":
      return ok({
        stub: true,
        command: input.command || "npm test",
        mode: "dry_run",
        cwd: bound.data.git_root,
      });
    case "web.browse":
      return ok({ stub: true, url: input.url || null, asked: input.asked === true });
    case "fleet.ack":
      return ok({ stub: true });
    case "life.food":
    case "life.flights":
    case "life.calendar":
    case "life.journal":
      return reject("LIFE_OS_DENIED", `${toolId} is life-OS and is not part of Studio`);
    default:
      return assertNever(toolId, "ToolId");
  }
}

module.exports = {
  normalizeMode,
  authorizeTool,
  listTools,
  invokeTool,
};
