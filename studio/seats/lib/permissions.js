"use strict";

const { reject, ok } = require("./codes");

/** Default tools a connected seat may use. chat.emit is room-only. */
const DEFAULT_TOOLS_ALLOWED = Object.freeze(["chat.emit", "board.read", "repo.read"]);

/** High-risk writes. Never in tools_allowed unless HITL is flagged. */
const HIGH_RISK_TOOLS = Object.freeze(["merge", "deploy", "public"]);

const SEAT_TOOLS = Object.freeze(DEFAULT_TOOLS_ALLOWED.concat(HIGH_RISK_TOOLS));

const CHAT_EMIT_SCOPE = "room-only";

function assertNeverTool(tool) {
  throw new Error(`unhandled SeatToolId: ${tool}`);
}

function isDefaultTool(tool) {
  return DEFAULT_TOOLS_ALLOWED.includes(tool);
}

function isHighRiskTool(tool) {
  return HIGH_RISK_TOOLS.includes(tool);
}

function isSeatTool(tool) {
  return SEAT_TOOLS.includes(tool);
}

function toolRequiresHitl(tool) {
  if (isHighRiskTool(tool)) {
    return true;
  }
  if (isDefaultTool(tool)) {
    return false;
  }
  return true;
}

function toolScopeOf(tool) {
  switch (tool) {
    case "chat.emit":
      return CHAT_EMIT_SCOPE;
    case "board.read":
      return "board";
    case "repo.read":
      return "repo";
    case "merge":
    case "deploy":
    case "public":
      return "hitl";
    default:
      return assertNeverTool(tool);
  }
}

function toolsAllowedFor(_provider, options) {
  const hitl = Boolean(options && options.hitl);
  const allowed = DEFAULT_TOOLS_ALLOWED.slice();
  if (hitl) {
    for (const tool of HIGH_RISK_TOOLS) {
      allowed.push(tool);
    }
  }
  return allowed;
}

function permissionOf(tool) {
  if (!isSeatTool(tool)) {
    return null;
  }
  const hitl = toolRequiresHitl(tool);
  const row = { tool, hitl };
  if (isDefaultTool(tool)) {
    row.scope = toolScopeOf(tool);
  }
  return row;
}

function defaultPermissionMatrix() {
  return DEFAULT_TOOLS_ALLOWED.map((tool) => permissionOf(tool));
}

function highRiskPermissionMatrix() {
  return HIGH_RISK_TOOLS.map((tool) => ({ tool, hitl: true }));
}

function isToolAllowed(_provider, tool, options) {
  const hitl = Boolean(options && options.hitl);
  if (isHighRiskTool(tool)) {
    return hitl;
  }
  return isDefaultTool(tool);
}

/**
 * Gate a seat tool. High-risk (merge/deploy/public) always needs HITL.
 * chat.emit is room-only — speech still goes through emit/classify.
 */
function authorizeTool(provider, tool, options) {
  const hitl = Boolean(options && options.hitl);
  if (isHighRiskTool(tool)) {
    if (!hitl) {
      return reject("TOOL_REQUIRES_HITL", `high-risk ${tool} always needs HITL`);
    }
    return ok({ provider, tool, hitl: true });
  }
  if (isDefaultTool(tool)) {
    const granted = { provider, tool, hitl: false };
    if (tool === "chat.emit") {
      granted.scope = CHAT_EMIT_SCOPE;
    }
    return ok(granted);
  }
  return reject("TOOL_NOT_ALLOWED", `tool ${tool} is not in the seat permission matrix`);
}

function permissionsLock() {
  return {
    default_tools_allowed: DEFAULT_TOOLS_ALLOWED.slice(),
    chat_emit_scope: CHAT_EMIT_SCOPE,
    high_risk: HIGH_RISK_TOOLS.slice(),
    high_risk_requires_hitl: true,
  };
}

module.exports = {
  DEFAULT_TOOLS_ALLOWED,
  HIGH_RISK_TOOLS,
  SEAT_TOOLS,
  CHAT_EMIT_SCOPE,
  assertNeverTool,
  isDefaultTool,
  isHighRiskTool,
  isSeatTool,
  toolRequiresHitl,
  toolScopeOf,
  toolsAllowedFor,
  permissionOf,
  defaultPermissionMatrix,
  highRiskPermissionMatrix,
  isToolAllowed,
  authorizeTool,
  permissionsLock,
};
