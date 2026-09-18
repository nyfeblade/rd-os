"use strict";

const {
  createStudioMcpServer,
  attachStdio,
  encodeFramed,
  createFrameParser,
  PROTOCOL_VERSION,
  SERVER_INFO,
  TOOLS,
  TOOL_SCHEMAS,
} = require("./server");
const {
  PROVIDERS,
  PROVIDER_IDS,
  isProviderId,
  getProvider,
  listProviders,
} = require("./lib/providers");
const { PERMISSION_MATRIX, HITL_OPS, permissionFor, assertMatrixComplete } = require("./lib/permissions");
const { CONNECT_ACK, IN_STUDIO_ONLY_LABEL, PRODUCT_LOCK, REJECT_CODES, HITL_CLASSES } = require("./lib/codes");
const { serverBinPath, attachEntry, attachConfig, attachConfigJson, preflight, probe } = require("./host");

module.exports = {
  createStudioMcpServer,
  attachStdio,
  encodeFramed,
  createFrameParser,
  PROTOCOL_VERSION,
  SERVER_INFO,
  TOOLS,
  TOOL_SCHEMAS,
  PROVIDERS,
  PROVIDER_IDS,
  isProviderId,
  getProvider,
  listProviders,
  PERMISSION_MATRIX,
  HITL_OPS,
  HITL_CLASSES,
  permissionFor,
  assertMatrixComplete,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  PRODUCT_LOCK,
  REJECT_CODES,
  serverBinPath,
  attachEntry,
  attachConfig,
  attachConfigJson,
  preflight,
  probe,
};
