"use strict";

const seats = require("../../seats");
const {
  createGrokBridge,
  connectGrokSeat,
  importTeamRoster,
  listImportableSeats,
  listImported,
  uiContract,
  advancedMcpAttachSpec,
  attachGrokMcp,
  resolveGrokProvider,
  UI_CONTRACT,
  UI_CONTRACT_PATH,
  ADVANCED_MCP_PATH,
  MCP_BIN_REL,
} = require("./lib/bridge");
const { PRODUCT_LOCK, CONNECT_ACK, IN_STUDIO_ONLY_LABEL, UI_CONTRACT_SCHEMA, STRANGER_PATH } = require("./lib/codes");

module.exports = {
  createGrokBridge,
  connectGrokSeat,
  importTeamRoster,
  listImportableSeats,
  listImported,
  uiContract,
  advancedMcpAttachSpec,
  attachGrokMcp,
  resolveGrokProvider,
  UI_CONTRACT,
  UI_CONTRACT_PATH,
  ADVANCED_MCP_PATH,
  MCP_BIN_REL,
  UI_CONTRACT_SCHEMA,
  STRANGER_PATH,
  PRODUCT_LOCK,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  IMPORTABLE_IDS: seats.IMPORTABLE_IDS,
  SKIPPED_IDS: seats.SKIPPED_IDS,
  GROK_ALIASES: seats.GROK_ALIASES,
  GROK_PROVIDER: seats.GROK_PROVIDER,
};
