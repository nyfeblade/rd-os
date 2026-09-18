"use strict";

const fs = require("fs");
const path = require("path");
const {
  CATALOG_SCHEMA,
  PRODUCT_LOCK,
  FORBIDDEN_P0,
  isKind,
  isTab,
  isTier,
  isCostClass,
  isHitl,
  isReservedId,
  reject,
  ok,
} = require("./codes");

const CATALOG_PATH = path.join(__dirname, "..", "catalog.json");

function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseEntry(raw, seen) {
  if (!raw || typeof raw !== "object") {
    return reject("CATALOG_INVALID", "entry is not an object");
  }
  const id = asString(raw.id);
  if (!id) {
    return reject("CATALOG_INVALID", "entry.id required");
  }
  if (isReservedId(id)) {
    return reject("LIFE_OS_FORBIDDEN", id);
  }
  if (seen.has(id)) {
    return reject("CATALOG_INVALID", `duplicate id ${id}`);
  }
  if (!isKind(raw.kind)) {
    return reject("CATALOG_INVALID", `entry.kind ${raw.kind}`);
  }
  if (!isTab(raw.tab)) {
    return reject("CATALOG_INVALID", `entry.tab ${raw.tab}`);
  }
  if (!isTier(raw.tier)) {
    return reject("CATALOG_INVALID", `entry.tier ${raw.tier}`);
  }
  const name = asString(raw.name);
  const job = asString(raw.job);
  const does = asString(raw.does);
  const toolsPointer = asString(raw.tools_pointer);
  if (!name || !job || !does || !toolsPointer) {
    return reject("CATALOG_INVALID", `entry ${id} missing copy`);
  }
  if (typeof raw.auth_required !== "boolean") {
    return reject("CATALOG_INVALID", `entry ${id} auth_required`);
  }
  if (!isCostClass(raw.cost_class)) {
    return reject("CATALOG_INVALID", `entry ${id} cost_class`);
  }
  if (typeof raw.two_way !== "boolean") {
    return reject("CATALOG_INVALID", `entry ${id} two_way`);
  }
  if (!isHitl(raw.hitl)) {
    return reject("CATALOG_INVALID", `entry ${id} hitl`);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "state")) {
    return reject("CATALOG_INVALID", `entry ${id} must not carry install state`);
  }
  seen.add(id);
  return ok({
    id,
    kind: raw.kind,
    tab: raw.tab,
    tier: raw.tier,
    name,
    job,
    does,
    auth_required: raw.auth_required,
    cost_class: raw.cost_class,
    two_way: raw.two_way,
    hitl: raw.hitl,
    tools_pointer: toolsPointer,
  });
}

function parseCatalog(raw) {
  if (!raw || typeof raw !== "object") {
    return reject("CATALOG_INVALID", "catalog is not an object");
  }
  if (raw.schema !== CATALOG_SCHEMA) {
    return reject("CATALOG_INVALID", `schema ${raw.schema}`);
  }
  if (raw.product_lock !== PRODUCT_LOCK) {
    return reject("CATALOG_INVALID", "product_lock");
  }
  if (!Array.isArray(raw.not)) {
    return reject("CATALOG_INVALID", "not");
  }
  for (const flag of FORBIDDEN_P0) {
    if (!raw.not.includes(flag)) {
      return reject("CATALOG_INVALID", `not missing ${flag}`);
    }
  }
  if (!Array.isArray(raw.tabs) || raw.tabs.join(",") !== "connectors,seats,modes") {
    return reject("CATALOG_INVALID", "tabs");
  }
  if (!Array.isArray(raw.entries)) {
    return reject("CATALOG_INVALID", "entries");
  }
  const seen = new Set();
  const entries = [];
  for (const row of raw.entries) {
    const parsed = parseEntry(row, seen);
    if (!parsed.ok) {
      return parsed;
    }
    entries.push(parsed.data);
  }
  return ok({
    schema: CATALOG_SCHEMA,
    product_lock: PRODUCT_LOCK,
    not: FORBIDDEN_P0.slice(),
    tabs: raw.tabs.slice(),
    entries,
  });
}

function loadCatalog(filePath) {
  const target = filePath || CATALOG_PATH;
  const raw = JSON.parse(fs.readFileSync(target, "utf8"));
  return parseCatalog(raw);
}

module.exports = {
  CATALOG_PATH,
  parseCatalog,
  loadCatalog,
};
