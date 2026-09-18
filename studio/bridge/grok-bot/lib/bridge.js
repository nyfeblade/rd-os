"use strict";

const fs = require("fs");
const path = require("path");
const {
  createStudioSeats,
  importRoster,
  listImported,
  listImportableSeats,
  resolveGrokProvider,
  HIGH_RISK_TOOLS,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  PRODUCT_LOCK,
} = require("../../../seats");
const { ok, reject, UI_CONTRACT_SCHEMA, STRANGER_PATH, assertNeverAlias } = require("./codes");

const UI_CONTRACT_PATH = path.join(__dirname, "..", "fixtures", "ui-contract.json");
const ADVANCED_MCP_PATH = path.join(__dirname, "..", "fixtures", "mcp.grok.advanced.json");
const MCP_BIN_REL = "studio/mcp/server/bin.js";

function loadUiContract() {
  const parsed = JSON.parse(fs.readFileSync(UI_CONTRACT_PATH, "utf8"));
  if (!parsed || parsed.schema !== UI_CONTRACT_SCHEMA || parsed.stranger_path !== STRANGER_PATH) {
    throw new Error("ui-contract.json must declare ui_click as the stranger path");
  }
  return parsed;
}

const UI_CONTRACT = loadUiContract();

function isStudio(studio) {
  return Boolean(studio && typeof studio === "object" && typeof studio.connect === "function");
}

function requireStudio(studio, apiName) {
  if (isStudio(studio)) {
    return null;
  }
  return reject("BAD_STUDIO", `${apiName}(studio) needs the live Studio seats instance the shell already holds`);
}

function resolveAlias(id) {
  const resolved = resolveGrokProvider(id);
  if (!resolved.ok) {
    return resolved;
  }
  const provider = resolved.data.provider;
  switch (provider) {
    case "grok":
      return resolved;
    default:
      return assertNeverAlias(provider);
  }
}

function connectGrokSeat(studio, id) {
  const bad = requireStudio(studio, "connectGrokSeat");
  if (bad) {
    return bad;
  }
  const resolved = resolveAlias(id);
  if (!resolved.ok) {
    return resolved;
  }
  const connected = studio.connect(resolved.data.provider);
  if (!connected.ok) {
    return connected;
  }
  const seat = connected.data.seat;
  const connection = connected.data.connection;
  if (!connection || connection.cutover !== true || !seat || seat.in_studio_only !== true) {
    return reject("CUTOVER_REQUIRED", "connectGrokSeat must land on seats.connect hard cutover");
  }
  return ok({
    connection,
    provider: connection.provider,
    connected_at: connection.connected_at,
    tools_allowed: connection.tools_allowed,
    cutover: true,
    in_studio_only: true,
    presence: seat.presence,
    seat,
    ack: connected.data.ack || CONNECT_ACK,
    in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    product_lock: PRODUCT_LOCK,
    alias: resolved.data.alias,
    hitl_still: HIGH_RISK_TOOLS.slice(),
  });
}

function importTeamRoster(studio) {
  const bad = requireStudio(studio, "importTeamRoster");
  if (bad) {
    return bad;
  }
  return importRoster(studio);
}

function uiContract() {
  return ok({
    schema: UI_CONTRACT.schema,
    stranger_path: UI_CONTRACT.stranger_path,
    actions: UI_CONTRACT.actions.slice(),
    alias: Object.assign({}, UI_CONTRACT.alias),
    provider: UI_CONTRACT.provider,
    on_connect: Object.assign({}, UI_CONTRACT.on_connect),
  });
}

function advancedMcpAttachSpec() {
  const spec = JSON.parse(fs.readFileSync(ADVANCED_MCP_PATH, "utf8"));
  return ok({
    note: spec.note,
    stranger_path: STRANGER_PATH,
    command: spec.mcpServers["ai-coding-studio-grok"].command,
    args: spec.mcpServers["ai-coding-studio-grok"].args.slice(),
    env: Object.assign({}, spec.mcpServers["ai-coding-studio-grok"].env),
    bin: MCP_BIN_REL,
    provider: "grok",
  });
}

/**
 * Optional MCP attach helper. Still measures seats.connect("grok").
 * Not the stranger path — shell clicks connectGrokSeat.
 */
function attachGrokMcp(studio, options) {
  const connected = connectGrokSeat(studio, options && options.id);
  if (!connected.ok) {
    return connected;
  }
  const spec = advancedMcpAttachSpec();
  if (!spec.ok) {
    return spec;
  }
  return ok({
    connection: connected.data,
    mcp: spec.data,
    spawned: false,
  });
}

function createGrokBridge(options) {
  const opts = options || {};
  const studio = opts.studio || createStudioSeats(opts);
  return {
    studio,
    importTeamRoster() {
      return importTeamRoster(studio);
    },
    connectGrokSeat(id) {
      return connectGrokSeat(studio, id);
    },
    listImportableSeats,
    listImported() {
      return listImported(studio);
    },
    uiContract,
    advancedMcpAttachSpec,
    attachGrokMcp(attachOpts) {
      return attachGrokMcp(studio, attachOpts);
    },
  };
}

module.exports = {
  UI_CONTRACT_PATH,
  ADVANCED_MCP_PATH,
  MCP_BIN_REL,
  UI_CONTRACT,
  createGrokBridge,
  connectGrokSeat,
  importTeamRoster,
  listImportableSeats,
  listImported,
  uiContract,
  advancedMcpAttachSpec,
  attachGrokMcp,
  resolveGrokProvider,
};
