"use strict";

const codes = require("./lib/codes");
const { loadCatalog, parseCatalog } = require("./lib/catalog");
const { createStudioMarketplace } = require("./lib/marketplace");

module.exports = {
  createStudioMarketplace,
  loadCatalog,
  parseCatalog,
  INSTALL_STATES: codes.INSTALL_STATES,
  ENTRY_KINDS: codes.ENTRY_KINDS,
  TABS: codes.TABS,
  REJECT_CODES: codes.REJECT_CODES,
  CATALOG_SCHEMA: codes.CATALOG_SCHEMA,
  STATE_SCHEMA: codes.STATE_SCHEMA,
  DUMP_SCHEMA: codes.DUMP_SCHEMA,
  PRODUCT_LOCK: codes.PRODUCT_LOCK,
  CUTOVER_LABEL: codes.CUTOVER_LABEL,
  CONNECT_ACK: codes.CONNECT_ACK,
  LEGAL_CHANNEL: codes.LEGAL_CHANNEL,
  EMPTY_INSTALLED: codes.EMPTY_INSTALLED,
  NO_MATCHES: codes.NO_MATCHES,
};
