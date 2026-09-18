"use strict";

/**
 * First-party coding-agent seat registry for Studio MCP.
 * Ids + labels only. Kind is always bot; cutover is always hard.
 * Not a vendor MCP catalog. Not a life-OS roster.
 */

const PROVIDERS = Object.freeze([
  Object.freeze({ id: "claude", label: "Claude" }),
  Object.freeze({ id: "grok", label: "Grok" }),
  Object.freeze({ id: "cursor", label: "Cursor" }),
  Object.freeze({ id: "codex", label: "Codex" }),
  Object.freeze({ id: "gemini", label: "Gemini" }),
  Object.freeze({ id: "chatgpt", label: "ChatGPT" }),
]);

const PROVIDER_IDS = Object.freeze(PROVIDERS.map((row) => row.id));

const BY_ID = Object.freeze(
  Object.fromEntries(PROVIDERS.map((row) => [row.id, row]))
);

function assertNeverProvider(id) {
  throw new Error(`unhandled StudioProviderId: ${id}`);
}

function isProviderId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(BY_ID, id);
}

function getProvider(id) {
  if (!isProviderId(id)) {
    return null;
  }
  return BY_ID[id];
}

function requireProvider(id) {
  switch (id) {
    case "claude":
    case "grok":
    case "cursor":
    case "codex":
    case "gemini":
    case "chatgpt":
      return BY_ID[id];
    default:
      return assertNeverProvider(id);
  }
}

function listProviders() {
  return PROVIDERS.map((row) => ({ id: row.id, label: row.label }));
}

function providerFields(row) {
  return Object.keys(row).sort();
}

module.exports = {
  PROVIDERS,
  PROVIDER_IDS,
  assertNeverProvider,
  isProviderId,
  getProvider,
  requireProvider,
  listProviders,
  providerFields,
};
