"use strict";

/**
 * studio/chat-engine — Chat is the engine. Board/dashboard is shell later.
 *
 * Fence: this tree only. Do not import from studio/shell.
 */

const { createChatEngine } = require("./lib/engine");
const { authorizeTool, listTools, normalizeMode } = require("./lib/tools");
const { parseGithubRemote, publicRemoteUrl } = require("./lib/remote");
const { defaultExecGit, resolveGitRoot } = require("./lib/git");
const {
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
  TOOLS,
  TOOL_IDS,
  TOOL_FAMILY,
  CODING_ALLOW,
  CODING_DENY,
  REJECT_CODES,
  HANDOFF_TARGETS,
  OUTCOME_SOURCES,
  OUTCOME_STATUSES,
  MEMORY_KINDS,
  FOCUS_SOURCES,
  describeReject,
  describeFamily,
  shellHints,
} = require("./lib/codes");

module.exports = {
  createChatEngine,
  authorizeTool,
  listTools,
  normalizeMode,
  parseGithubRemote,
  publicRemoteUrl,
  resolveGitRoot,
  defaultExecGit,
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
  TOOLS,
  TOOL_IDS,
  TOOL_FAMILY,
  CODING_ALLOW,
  CODING_DENY,
  REJECT_CODES,
  HANDOFF_TARGETS,
  OUTCOME_SOURCES,
  OUTCOME_STATUSES,
  MEMORY_KINDS,
  FOCUS_SOURCES,
  describeReject,
  describeFamily,
  shellHints,
};
