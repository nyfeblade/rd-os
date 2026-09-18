"use strict";

const { assertNever } = require("./result");

const SCHEMA = "studio.chat.engine/v1";
const THREAD_SCHEMA = "studio.chat.thread/v1";
const CONTEXT_SCHEMA = "studio.chat.context/v1";
const MEMORY_SCHEMA = "studio.chat.memory/v1";
const HANDOFF_SCHEMA = "studio.chat.handoff/v1";
const OUTCOME_SCHEMA = "studio.chat.outcome/v1";

const FENCE = "studio/chat-engine";
const PRODUCT_LOCK = "no_orphan_generic_chat";
const ASSUME_SNAPSHOT_TRUTH =
  "assume workspace context is true; do not ask user to paste diffs/logs already in snapshot";

const DEFAULT_MODE = "coding";
const MODES = Object.freeze(["coding", "general"]);
const DEFAULT_COMMIT_COUNT = 8;
const MEMORY_CAP = 200;
const EVENT_CAP = 500;
const DIRTY_FILE_CAP = 100;

const MEMORY_KINDS = Object.freeze(["decision", "path", "attempt", "note"]);
const FOCUS_SOURCES = Object.freeze(["code", "last_touched", "explicit"]);
const HANDOFF_TARGETS = Object.freeze(["cursor_ca", "claude_code"]);
const HANDOFF_MODES = Object.freeze(["dry_run", "stub"]);
const OUTCOME_SOURCES = Object.freeze(["ca", "pr", "ci", "claude_code"]);
const OUTCOME_STATUSES = Object.freeze(["queued", "running", "success", "failure", "cancelled", "unknown"]);

const TOOL_FAMILY = Object.freeze(["fs", "git", "github", "handoff", "test", "web", "fleet", "life"]);

const TOOL_DEFS = Object.freeze([
  ["fs.read", { family: "fs", modes: ["coding", "general"] }],
  ["fs.list", { family: "fs", modes: ["coding", "general"] }],
  ["fs.diff", { family: "fs", modes: ["coding", "general"] }],
  ["git.status", { family: "git", modes: ["coding", "general"] }],
  ["git.log", { family: "git", modes: ["coding", "general"] }],
  ["git.show", { family: "git", modes: ["coding", "general"] }],
  ["git.diff", { family: "git", modes: ["coding", "general"] }],
  ["git.branch", { family: "git", modes: ["coding", "general"] }],
  ["github.pr.read", { family: "github", modes: ["coding", "general"] }],
  ["github.ci.read", { family: "github", modes: ["coding", "general"] }],
  ["github.review.read", { family: "github", modes: ["coding", "general"] }],
  ["handoff.cursor_ca", { family: "handoff", modes: ["coding", "general"] }],
  ["handoff.claude_code", { family: "handoff", modes: ["coding", "general"] }],
  ["test.run", { family: "test", modes: ["coding", "general"] }],
  ["web.browse", { family: "web", modes: ["coding", "general"], codingRequiresAsked: true }],
  ["fleet.ack", { family: "fleet", modes: ["general"] }],
  ["life.food", { family: "life", modes: [] }],
  ["life.flights", { family: "life", modes: [] }],
  ["life.calendar", { family: "life", modes: [] }],
  ["life.journal", { family: "life", modes: [] }],
]);

const TOOLS = Object.freeze(
  Object.fromEntries(TOOL_DEFS.map(([id, spec]) => [id, Object.freeze({ id, ...spec })]))
);
const TOOL_IDS = Object.freeze(TOOL_DEFS.map(([id]) => id));

const CODING_ALLOW = Object.freeze(
  TOOL_IDS.filter((id) => {
    const tool = TOOLS[id];
    return tool.family !== "life" && tool.modes.includes("coding") && !tool.codingRequiresAsked;
  })
);

const CODING_DENY = Object.freeze(
  TOOL_IDS.filter((id) => {
    const tool = TOOLS[id];
    return tool.family === "life" || !tool.modes.includes("coding") || tool.codingRequiresAsked;
  })
);

const REJECT_CODES = Object.freeze([
  "UNBOUND_THREAD",
  "THREAD_NOT_FOUND",
  "BIND_PATH_MISSING",
  "BIND_NOT_GIT",
  "GIT_UNAVAILABLE",
  "GIT_EXEC",
  "PATH_OUTSIDE_REPO",
  "TOOL_DENIED",
  "UNKNOWN_TOOL",
  "UNKNOWN_MODE",
  "UNKNOWN_HANDOFF_TARGET",
  "UNKNOWN_OUTCOME_SOURCE",
  "UNKNOWN_OUTCOME_STATUS",
  "UNKNOWN_MEMORY_KIND",
  "STORE_CORRUPT",
  "BAD_ARGUMENT",
  "LIFE_OS_DENIED",
]);

function describeReject(code) {
  switch (code) {
    case "UNBOUND_THREAD":
      return "every thread must bind a project/repo — no orphan generic chat";
    case "THREAD_NOT_FOUND":
      return "thread id is not in the engine store";
    case "BIND_PATH_MISSING":
      return "bind path does not exist";
    case "BIND_NOT_GIT":
      return "bind path is not inside a git work tree";
    case "GIT_UNAVAILABLE":
      return "git executable not found";
    case "GIT_EXEC":
      return "git command failed";
    case "PATH_OUTSIDE_REPO":
      return "path is outside the bound repo";
    case "TOOL_DENIED":
      return "tool is outside the current mode allowlist";
    case "UNKNOWN_TOOL":
      return "tool id is not in the closed catalog";
    case "UNKNOWN_MODE":
      return "mode must be coding or general";
    case "UNKNOWN_HANDOFF_TARGET":
      return "handoff target must be cursor_ca or claude_code";
    case "UNKNOWN_OUTCOME_SOURCE":
      return "outcome source must be ca, pr, ci, or claude_code";
    case "UNKNOWN_OUTCOME_STATUS":
      return "outcome status is not in the closed set";
    case "UNKNOWN_MEMORY_KIND":
      return "memory kind must be decision, path, attempt, or note";
    case "STORE_CORRUPT":
      return "persisted engine state could not be read";
    case "BAD_ARGUMENT":
      return "required argument missing or malformed";
    case "LIFE_OS_DENIED":
      return "life-OS tools are not part of Studio";
    default:
      return assertNever(code, "RejectCode");
  }
}

function describeFamily(family) {
  switch (family) {
    case "fs":
      return "local filesystem / repo";
    case "git":
      return "git";
    case "github":
      return "GitHub PR/CI read";
    case "handoff":
      return "spawn/brief Cursor CA or Claude Code";
    case "test":
      return "optional test runner";
    case "web":
      return "web browse (coding mode: only if asked)";
    case "fleet":
      return "chatty fleet acks";
    case "life":
      return "food / flights / life-OS";
    default:
      return assertNever(family, "ToolFamily");
  }
}

function shellHints() {
  return {
    pane: "Chat",
    role: "engine",
    chrome: "not-owned",
    sibling_later: "Board",
    dashboard: false,
    marketplace: false,
    paste_and_pray: false,
    owns: ["bind", "snapshot", "focus", "memory", "coding_mode", "handoff", "outcomes"],
    does_not_own: ["shell", "board", "dashboard", "marketplace", "life-os", "connectors-ui"],
  };
}

module.exports = {
  SCHEMA,
  THREAD_SCHEMA,
  CONTEXT_SCHEMA,
  MEMORY_SCHEMA,
  HANDOFF_SCHEMA,
  OUTCOME_SCHEMA,
  FENCE,
  PRODUCT_LOCK,
  ASSUME_SNAPSHOT_TRUTH,
  DEFAULT_MODE,
  MODES,
  DEFAULT_COMMIT_COUNT,
  MEMORY_CAP,
  EVENT_CAP,
  DIRTY_FILE_CAP,
  MEMORY_KINDS,
  FOCUS_SOURCES,
  HANDOFF_TARGETS,
  HANDOFF_MODES,
  OUTCOME_SOURCES,
  OUTCOME_STATUSES,
  TOOL_FAMILY,
  TOOLS,
  TOOL_IDS,
  TOOL_DEFS,
  CODING_ALLOW,
  CODING_DENY,
  REJECT_CODES,
  describeReject,
  describeFamily,
  shellHints,
};
