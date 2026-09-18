"use strict";

const INSTALL_STATES = Object.freeze(["available", "needs_auth", "live", "error"]);
const ENTRY_KINDS = Object.freeze(["seat", "connector", "mcp"]);
const TABS = Object.freeze(["connectors", "seats", "modes"]);
const TIERS = Object.freeze(["p0"]);
const COST_CLASSES = Object.freeze(["lean", "normal", "heavy"]);
const HITL_TIERS = Object.freeze(["low", "high-risk"]);
const COMMANDS = Object.freeze(["install", "connect", "revoke"]);
const CATALOG_SCHEMA = "studio.marketplace.catalog/v1";
const STATE_SCHEMA = "studio.marketplace.state/v1";
const DUMP_SCHEMA = "studio.marketplace.dump/v1";
const PRODUCT_LOCK = "eng_native_discover_install_manage";
const CUTOVER_LABEL = "in-studio-only";
const CONNECT_ACK = "This seat works in Studio only while connected.";
const LEGAL_CHANNEL = "studio_room";
const EMPTY_INSTALLED = "Nothing installed — connect GitHub or Slack to start";
const NO_MATCHES = "No matches";
const CLEAR_FILTERS = "clear filters";

const REJECT_CODES = Object.freeze([
  "UNKNOWN_ENTRY",
  "UNKNOWN_TAB",
  "UNKNOWN_COMMAND",
  "CATALOG_INVALID",
  "LIFE_OS_FORBIDDEN",
  "STORE_CORRUPT",
]);

const RESERVED_IDS = Object.freeze([
  "luke",
  "owner",
  "operator",
  "life",
  "life-os",
  "journal",
  "personal",
  "family",
  "calendar",
  "waiting",
]);

const FORBIDDEN_P0 = Object.freeze([
  "grok_bot_chrome",
  "life_os_connectors_p0",
  "waiting_table",
  "generic_agent_mall",
]);

const SEAT_CUTOVER_DOES =
  "Hard cutover attaches the seat. It works in Studio only while connected. Legal speech is studio_room. Operator 1:1 and external Slack or Discord dests reject. Detach is locked. Go offline to leave the roster.";

const STATE_FIELDS = Object.freeze(["state", "error", "installed_at", "updated_at"]);

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function isInstallState(value) {
  return INSTALL_STATES.includes(value);
}

function isKind(value) {
  return ENTRY_KINDS.includes(value);
}

function isTab(value) {
  return TABS.includes(value);
}

function isTier(value) {
  return TIERS.includes(value);
}

function isCostClass(value) {
  return COST_CLASSES.includes(value);
}

function isHitl(value) {
  return value === null || HITL_TIERS.includes(value);
}

function isCommand(value) {
  return COMMANDS.includes(value);
}

function isReservedId(id) {
  return RESERVED_IDS.includes(id);
}

function assertNeverState(state) {
  throw new Error(`unhandled InstallState: ${state}`);
}

function assertNeverKind(kind) {
  throw new Error(`unhandled EntryKind: ${kind}`);
}

function assertNeverTab(tab) {
  throw new Error(`unhandled MarketplaceTab: ${tab}`);
}

function assertNeverCommand(command) {
  throw new Error(`unhandled MarketplaceCommand: ${command}`);
}

function assertNeverReject(code) {
  throw new Error(`unhandled MarketplaceRejectCode: ${code}`);
}

function primaryCta(kind, state) {
  switch (state) {
    case "available":
      return kind === "seat" ? "Add seat" : "Connect";
    case "needs_auth":
      return "Fix auth";
    case "live":
      return "Manage";
    case "error":
      return "Re-auth";
    default:
      return assertNeverState(state);
  }
}

function actionsFor(kind, state) {
  switch (state) {
    case "available":
      return [primaryCta(kind, state)];
    case "needs_auth":
      return ["Fix auth", "Revoke"];
    case "live":
      return ["Manage", "Re-auth", "Revoke"];
    case "error":
      return ["Re-auth", "Retry", "Revoke"];
    default:
      return assertNeverState(state);
  }
}

function isInstalledState(state) {
  return state === "needs_auth" || state === "live" || state === "error";
}

module.exports = {
  INSTALL_STATES,
  ENTRY_KINDS,
  TABS,
  TIERS,
  COST_CLASSES,
  HITL_TIERS,
  COMMANDS,
  CATALOG_SCHEMA,
  STATE_SCHEMA,
  DUMP_SCHEMA,
  PRODUCT_LOCK,
  CUTOVER_LABEL,
  CONNECT_ACK,
  LEGAL_CHANNEL,
  EMPTY_INSTALLED,
  NO_MATCHES,
  CLEAR_FILTERS,
  REJECT_CODES,
  RESERVED_IDS,
  FORBIDDEN_P0,
  SEAT_CUTOVER_DOES,
  STATE_FIELDS,
  reject,
  ok,
  isInstallState,
  isKind,
  isTab,
  isTier,
  isCostClass,
  isHitl,
  isCommand,
  isReservedId,
  assertNeverState,
  assertNeverKind,
  assertNeverTab,
  assertNeverCommand,
  assertNeverReject,
  primaryCta,
  actionsFor,
  isInstalledState,
};
