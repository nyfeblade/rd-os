"use strict";

const { HITL_CLASSES, assertNeverHitlClass, isToolName } = require("./codes");
const { PROVIDER_IDS, isProviderId, assertNeverProvider } = require("./providers");

const ALLOW = "allow";
const DENY = "deny";
const HITL = "hitl";

const HITL_OPS = Object.freeze({
  "studio.merge": Object.freeze({
    class: "merge",
    detail: "Merge requires Board Approve (HITL). This server does not expose a merge tool.",
  }),
  "studio.deploy": Object.freeze({
    class: "deploy",
    detail: "Deploy requires Board Approve (HITL). This server does not expose a deploy tool.",
  }),
  "studio.db.mutate": Object.freeze({
    class: "db",
    detail: "DB mutate requires Board Approve (HITL). This server does not expose a DB write tool.",
  }),
  "studio.public_post": Object.freeze({
    class: "public_post",
    detail:
      "Public post requires in-studio-only cutover AND Board Approve (HITL). This server does not expose a public-post tool.",
  }),
});

function allowAllProviders() {
  return Object.freeze(Object.fromEntries(PROVIDER_IDS.map((id) => [id, ALLOW])));
}

const PERMISSION_MATRIX = Object.freeze({
  "studio.seats.list": allowAllProviders(),
  "studio.seats.presence": allowAllProviders(),
  "studio.chat.snapshot": allowAllProviders(),
  "studio.board.list_gates": allowAllProviders(),
  "studio.repo.bind_info": allowAllProviders(),
});

function hitlClassOf(name) {
  const op = HITL_OPS[name];
  if (!op) {
    return null;
  }
  switch (op.class) {
    case "merge":
    case "deploy":
    case "db":
    case "public_post":
      return op;
    default:
      return assertNeverHitlClass(op.class);
  }
}

function cellFor(providerId, toolName) {
  if (!isProviderId(providerId)) {
    return assertNeverProvider(providerId);
  }
  const row = PERMISSION_MATRIX[toolName];
  if (!row) {
    return null;
  }
  const cell = row[providerId];
  if (cell == null) {
    throw new Error(`permission matrix missing cell ${toolName} × ${providerId}`);
  }
  switch (cell) {
    case ALLOW:
    case DENY:
    case HITL:
      return cell;
    default:
      throw new Error(`unhandled permission cell: ${cell}`);
  }
}

function permissionFor(providerId, toolName) {
  if (!isProviderId(providerId)) {
    return { kind: "unknown_provider", provider: providerId, tool: toolName };
  }
  const hitl = hitlClassOf(toolName);
  if (hitl) {
    return {
      kind: HITL,
      provider: providerId,
      tool: toolName,
      class: hitl.class,
      detail: hitl.detail,
    };
  }
  if (!isToolName(toolName)) {
    return { kind: "unknown_tool", provider: providerId, tool: toolName };
  }
  const cell = cellFor(providerId, toolName);
  return { kind: cell, provider: providerId, tool: toolName };
}

function assertMatrixComplete() {
  const missing = [];
  for (const toolName of Object.keys(PERMISSION_MATRIX)) {
    for (const id of PROVIDER_IDS) {
      if (PERMISSION_MATRIX[toolName][id] == null) {
        missing.push(`${toolName}×${id}`);
      }
    }
  }
  if (missing.length) {
    throw new Error(`permission matrix incomplete: ${missing.join(",")}`);
  }
  return true;
}

function hitlRequired(className) {
  if (!HITL_CLASSES.includes(className)) {
    return assertNeverHitlClass(className);
  }
  return true;
}

module.exports = {
  ALLOW,
  DENY,
  HITL,
  HITL_OPS,
  HITL_CLASSES,
  PERMISSION_MATRIX,
  permissionFor,
  hitlClassOf,
  assertMatrixComplete,
  hitlRequired,
};
