"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ok, reject, isNonEmptyString } = require("./result");
const { DEFAULT_COMMIT_COUNT, DIRTY_FILE_CAP } = require("./codes");
const { publicRemoteUrl } = require("./remote");

function defaultExecGit(args, options) {
  const cwd = options && options.cwd ? options.cwd : process.cwd();
  const timeout = options && Number.isFinite(options.timeout) ? options.timeout : 15000;
  const result = spawnSync("git", ["-c", "safe.directory=*", ...args], {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 2 * 1024 * 1024,
    env: Object.assign({}, process.env, { GIT_OPTIONAL_LOCKS: "0" }),
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      return reject("GIT_UNAVAILABLE", "git executable not found");
    }
    return reject("GIT_EXEC", result.error.message || String(result.error));
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "git failed").trim();
    return reject("GIT_EXEC", detail, { status: result.status });
  }
  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function git(execGit, args, cwd) {
  return execGit(args, { cwd });
}

function resolveExisting(input) {
  if (!isNonEmptyString(input)) {
    return reject("BAD_ARGUMENT", "repo path is required");
  }
  const abs = path.resolve(String(input).trim());
  try {
    const stat = fs.statSync(abs);
    const start = stat.isDirectory() ? abs : path.dirname(abs);
    return ok({ start, requested: abs });
  } catch (_err) {
    return reject("BIND_PATH_MISSING", `${abs} does not exist`);
  }
}

function resolveGitRoot(input, execGit) {
  const existing = resolveExisting(input);
  if (!existing.ok) {
    return existing;
  }
  const ran = git(execGit, ["rev-parse", "--show-toplevel"], existing.data.start);
  if (!ran.ok) {
    if (ran.code === "GIT_UNAVAILABLE") {
      return ran;
    }
    return reject("BIND_NOT_GIT", `${existing.data.start} is not inside a git work tree`);
  }
  const raw = String(ran.stdout || "").trim();
  if (!raw) {
    return reject("BIND_NOT_GIT", "git toplevel was empty");
  }
  try {
    return ok({ git_root: fs.realpathSync(raw), requested: existing.data.requested });
  } catch (_err) {
    return ok({ git_root: path.resolve(raw), requested: existing.data.requested });
  }
}

function unquoteGitPath(value) {
  const raw = String(value || "");
  if (raw.charAt(0) !== '"' || raw.charAt(raw.length - 1) !== '"') {
    return raw;
  }
  return raw
    .slice(1, -1)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parsePorcelain(text) {
  const lines = String(text || "").split(/\r?\n/);
  const files = [];
  let branchLine = "";
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.startsWith("## ")) {
      branchLine = line.slice(3);
      continue;
    }
    const status = line.slice(0, 2);
    let rest = line.length > 3 ? line.slice(3) : "";
    if (rest.includes(" -> ")) {
      rest = rest.split(" -> ").pop();
    }
    files.push({ status, path: unquoteGitPath(rest) });
    if (files.length >= DIRTY_FILE_CAP) {
      break;
    }
  }
  return { branchLine, files };
}

function parseLog(text) {
  const commits = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    const parts = line.split("\x1f");
    if (parts.length < 4) {
      continue;
    }
    commits.push({
      sha: parts[0],
      subject: parts[1],
      author: parts[2],
      date: parts[3],
    });
  }
  return commits;
}

function captureRoot(gitRoot, execGit, commitCount) {
  const n = Number.isFinite(commitCount) && commitCount > 0 ? Math.floor(commitCount) : DEFAULT_COMMIT_COUNT;
  const headRan = git(execGit, ["rev-parse", "HEAD"], gitRoot);
  const empty = !headRan.ok;
  const head = empty ? null : String(headRan.stdout || "").trim() || null;
  const branchRan = git(execGit, ["rev-parse", "--abbrev-ref", "HEAD"], gitRoot);
  const branchName = branchRan.ok ? String(branchRan.stdout || "").trim() : "";
  const detached = !branchName || branchName === "HEAD";
  const branch = detached ? null : branchName;
  const statusRan = git(execGit, ["status", "--porcelain=v1", "-b"], gitRoot);
  const porcelain = statusRan.ok ? parsePorcelain(statusRan.stdout) : { branchLine: "", files: [] };
  const commitsRan = empty
    ? { ok: true, stdout: "" }
    : git(execGit, ["log", `-n${n}`, "--format=%H%x1f%s%x1f%an%x1f%aI"], gitRoot);
  const remoteRan = git(execGit, ["remote", "get-url", "origin"], gitRoot);
  return {
    git_root: gitRoot,
    empty,
    detached,
    branch,
    head,
    head_short: head ? head.slice(0, 12) : null,
    dirty: porcelain.files.length > 0,
    dirty_files: porcelain.files,
    commits: commitsRan.ok ? parseLog(commitsRan.stdout) : [],
    remote_url: remoteRan.ok ? publicRemoteUrl(String(remoteRan.stdout || "").trim()) : null,
  };
}

function inferLastTouched(gitRoot, snapshot, execGit) {
  const dirty = snapshot && Array.isArray(snapshot.dirty_files) ? snapshot.dirty_files : [];
  if (dirty.length > 0 && dirty[0].path) {
    return dirty[0].path;
  }
  const names = git(execGit, ["log", "-1", "--name-only", "--pretty=format:"], gitRoot);
  if (!names.ok) {
    return null;
  }
  for (const line of String(names.stdout || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

module.exports = {
  defaultExecGit,
  resolveGitRoot,
  captureRoot,
  inferLastTouched,
};
