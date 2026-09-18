"use strict";

const {
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  PRODUCT_LOCK,
} = require("../../seats");

const PROTOCOL_VERSION = "2024-11-05";
const PROTOCOL_VERSIONS = Object.freeze(["2024-11-05", "2025-03-26", "2025-06-18"]);
const SERVER_INFO = Object.freeze({ name: "ai-coding-studio", version: "0.1.0" });
const PRODUCT = "AI Coding Studio";
const FENCE = "studio/mcp";
const DUMP_SCHEMA = "studio.mcp.dump/v1";
const CHAT_SNAPSHOT_SCHEMA = "studio.chat.snapshot/v1";
const BOARD_GATES_SCHEMA = "studio.board.gates/v1";
const REPO_BIND_SCHEMA = "studio.repo.bind/v1";

const TOOLS = Object.freeze([
  "studio.seats.list",
  "studio.seats.presence",
  "studio.chat.snapshot",
  "studio.board.list_gates",
  "studio.repo.bind_info",
]);

const REJECT_CODES = Object.freeze([
  "UNKNOWN_PROVIDER",
  "UNKNOWN_TOOL",
  "NOT_CONNECTED",
  "TOOL_FORBIDDEN",
  "HITL_REQUIRED",
  "BAD_ARGUMENTS",
  "PROVIDER_MISMATCH",
]);

const HITL_CLASSES = Object.freeze(["merge", "deploy", "db", "public_post"]);

function ok(data) {
  return { ok: true, data };
}

function reject(code, detail, extra) {
  const result = { ok: false, code, detail: detail || "" };
  if (extra && typeof extra === "object") {
    Object.assign(result, extra);
  }
  return result;
}

function assertNeverReject(code) {
  throw new Error(`unhandled StudioMcpReject: ${code}`);
}

function assertNeverTool(name) {
  throw new Error(`unhandled StudioMcpTool: ${name}`);
}

function assertNeverHitlClass(kind) {
  throw new Error(`unhandled HitlClass: ${kind}`);
}

function describeReject(code) {
  switch (code) {
    case "UNKNOWN_PROVIDER":
      return "provider id is not in the Studio MCP registry";
    case "UNKNOWN_TOOL":
      return "tool is not on the Studio MCP surface";
    case "NOT_CONNECTED":
      return "initialize the MCP session before calling tools";
    case "TOOL_FORBIDDEN":
      return "this provider is not allowed to call that tool";
    case "HITL_REQUIRED":
      return "merge / deploy / DB / public post still require Board Approve";
    case "BAD_ARGUMENTS":
      return "tool arguments are missing or malformed";
    case "PROVIDER_MISMATCH":
      return "session provider does not match the requested seat";
    default:
      return assertNeverReject(code);
  }
}

function negotiateProtocol(requested) {
  if (PROTOCOL_VERSIONS.includes(requested)) {
    return requested;
  }
  return PROTOCOL_VERSION;
}

function isToolName(name) {
  return TOOLS.includes(name);
}

module.exports = {
  PROTOCOL_VERSION,
  PROTOCOL_VERSIONS,
  SERVER_INFO,
  PRODUCT,
  FENCE,
  DUMP_SCHEMA,
  CHAT_SNAPSHOT_SCHEMA,
  BOARD_GATES_SCHEMA,
  REPO_BIND_SCHEMA,
  TOOLS,
  REJECT_CODES,
  HITL_CLASSES,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  PRODUCT_LOCK,
  ok,
  reject,
  assertNeverReject,
  assertNeverTool,
  assertNeverHitlClass,
  describeReject,
  negotiateProtocol,
  isToolName,
};
