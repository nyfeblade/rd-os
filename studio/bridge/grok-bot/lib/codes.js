"use strict";

const seats = require("../../../seats");

const PRODUCT_LOCK = seats.PRODUCT_LOCK;
const CONNECT_ACK = seats.CONNECT_ACK;
const IN_STUDIO_ONLY_LABEL = seats.IN_STUDIO_ONLY_LABEL;
const UI_CONTRACT_SCHEMA = "studio.bridge.grok-bot.ui/v1";
const STRANGER_PATH = "ui_click";

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNeverAlias(id) {
  throw new Error(`unhandled GrokSeatAlias: ${id}`);
}

module.exports = {
  PRODUCT_LOCK,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  UI_CONTRACT_SCHEMA,
  STRANGER_PATH,
  reject,
  ok,
  assertNeverAlias,
};
