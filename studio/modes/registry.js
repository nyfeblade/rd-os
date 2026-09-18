"use strict";

/**
 * Selectable mode registry. Chat-engine and seats call this later.
 * JSON in catalog/ is loaded and executed; it is not a dead listing.
 */

const fs = require("fs");
const path = require("path");

const { RAILS, VIOLATION_CODES, normalizePath, underPrefix } = require("./rails");

const CATALOG_DIR = path.join(__dirname, "catalog");
const ROOT = path.resolve(__dirname);

const REGISTRY_CODES = Object.freeze([
  "LANE_COLLISION",
  "UNKNOWN_MODE",
  "FALSIFIER_MISSED",
  "BAD_ARGUMENT",
  "LIFE_OS_DENIED",
]);

function ok(data) {
  return { ok: true, data, verdict: null, clock_started: false };
}

function reject(code, detail) {
  if (!REGISTRY_CODES.includes(code)) {
    throw new Error(`registry code not in closed set: ${code}`);
  }
  return { ok: false, code, detail: detail || "", verdict: null, clock_started: false };
}

function isLifeOsId(id) {
  const n = String(id || "")
    .trim()
    .toLowerCase();
  return n === "life" || n.startsWith("life.") || n.startsWith("life-") || n.startsWith("life_");
}

function fencesOverlap(left, right) {
  for (const a of left) {
    for (const b of right) {
      if (underPrefix(a, b) || underPrefix(b, a)) return true;
    }
  }
  return false;
}

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function parseMode(raw, source) {
  if (!raw || typeof raw !== "object") throw new Error(`invalid mode at ${source}`);
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) throw new Error(`mode missing id at ${source}`);
  if (isLifeOsId(id)) throw new Error(`life-OS mode ${id} is not part of Studio`);
  if (!RAILS.includes(raw.rail)) {
    throw new Error(`mode ${id} rail ${JSON.stringify(raw.rail)} not in ${RAILS.join("|")}`);
  }
  if (typeof raw.falsifier !== "string" || !raw.falsifier.trim()) {
    throw new Error(`mode ${id} missing falsifier`);
  }
  if (!Array.isArray(raw.fences) || raw.fences.length === 0) {
    throw new Error(`mode ${id} needs at least one fence`);
  }
  const fences = raw.fences.map(normalizePath);
  if (fences.some((prefix) => !prefix)) throw new Error(`mode ${id} has an empty fence`);

  const planted = raw.planted;
  if (!planted || typeof planted.file !== "string" || !planted.file.trim()) {
    throw new Error(`mode ${id} missing planted.file`);
  }
  if (!VIOLATION_CODES.includes(planted.expect_code)) {
    throw new Error(`mode ${id} planted.expect_code not in the closed violation set`);
  }
  const plantedAbs = path.resolve(ROOT, planted.file);
  if (plantedAbs !== ROOT && !plantedAbs.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`mode ${id} planted file escapes studio/modes`);
  }
  if (!fs.existsSync(plantedAbs)) throw new Error(`mode ${id} planted file missing: ${planted.file}`);

  return {
    id,
    rail: raw.rail,
    lane: typeof raw.lane === "string" && raw.lane.trim() ? raw.lane.trim() : null,
    falsifier: raw.falsifier.trim(),
    fences,
    planted: { file: planted.file.trim(), expect_code: planted.expect_code },
  };
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_DIR)) return [];
  const names = fs
    .readdirSync(CATALOG_DIR)
    .filter((name) => name.endsWith(".mode.json"))
    .sort();
  const modes = names.map((name) => {
    const abs = path.join(CATALOG_DIR, name);
    return parseMode(readJson(abs), abs);
  });
  const seen = new Set();
  for (const mode of modes) {
    if (seen.has(mode.id)) throw new Error(`duplicate catalog id ${mode.id}`);
    seen.add(mode.id);
  }
  for (let i = 0; i < modes.length; i += 1) {
    for (let j = i + 1; j < modes.length; j += 1) {
      if (fencesOverlap(modes[i].fences, modes[j].fences)) {
        throw new Error(`catalog fence overlap ${modes[i].id} vs ${modes[j].id}`);
      }
    }
  }
  return modes;
}

function publicMode(mode, enabled) {
  return {
    id: mode.id,
    rail: mode.rail,
    lane: mode.lane,
    falsifier: mode.falsifier,
    fences: [...mode.fences],
    enabled,
  };
}

function gradePlanted(file) {
  return require("./index").evaluateFile(path.resolve(ROOT, file));
}

function createModeRegistry(opts) {
  const options = opts || {};
  const catalog = loadCatalog();
  const extra = Array.isArray(options.extra) ? options.extra : [];
  for (const row of extra) {
    const mode = parseMode(row, "extra");
    if (catalog.some((item) => item.id === mode.id)) {
      throw new Error(`extra catalog id ${mode.id} collides with a shipped mode`);
    }
    catalog.push(mode);
  }
  catalog.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const byId = new Map(catalog.map((mode) => [mode.id, mode]));
  const enabled = new Set();
  let active = null;

  function listModes() {
    return ok({ modes: catalog.map((mode) => publicMode(mode, enabled.has(mode.id))) });
  }

  function enableMode(id) {
    if (typeof id !== "string" || !id.trim()) {
      return reject("BAD_ARGUMENT", "enableMode needs a mode id");
    }
    const name = id.trim();
    if (isLifeOsId(name)) {
      return reject("LIFE_OS_DENIED", `${name} is life-OS and is not part of Studio`);
    }
    const mode = byId.get(name);
    if (!mode) {
      return reject("UNKNOWN_MODE", `unknown mode "${name}"; have ${catalog.map((row) => row.id).join(", ")}`);
    }
    if (enabled.has(name)) {
      active = name;
      return ok({ mode: publicMode(mode, true) });
    }
    for (const otherId of enabled) {
      const other = byId.get(otherId);
      if (fencesOverlap(mode.fences, other.fences)) {
        return reject(
          "LANE_COLLISION",
          `${name} fences (${mode.fences.join(", ")}) overlap ${otherId} (${other.fences.join(", ")})`
        );
      }
    }
    enabled.add(name);
    active = name;
    return ok({ mode: publicMode(mode, true) });
  }

  function activeMode() {
    if (!active) return ok({ mode: null });
    return ok({ mode: publicMode(byId.get(active), true) });
  }

  function assertFalsifier(id) {
    if (typeof id !== "string" || !id.trim()) {
      return reject("BAD_ARGUMENT", "assertFalsifier needs a mode id");
    }
    const name = id.trim();
    if (isLifeOsId(name)) {
      return reject("LIFE_OS_DENIED", `${name} is life-OS and is not part of Studio`);
    }
    const mode = byId.get(name);
    if (!mode) {
      return reject("UNKNOWN_MODE", `unknown mode "${name}"; have ${catalog.map((row) => row.id).join(", ")}`);
    }
    const report = gradePlanted(mode.planted.file);
    const codes = report.violations.map((row) => row.code);
    if (!codes.includes(mode.planted.expect_code)) {
      return reject(
        "FALSIFIER_MISSED",
        `${name} planted ${mode.planted.file} did not trip ${mode.planted.expect_code}; got [${codes.join(",") || "none"}]`
      );
    }
    return ok({
      mode: publicMode(mode, enabled.has(name)),
      code: mode.planted.expect_code,
      falsifier: mode.falsifier,
      file: mode.planted.file,
    });
  }

  return {
    listModes,
    enableMode,
    activeMode,
    assertFalsifier,
  };
}

module.exports = {
  CATALOG_DIR,
  REGISTRY_CODES,
  createModeRegistry,
  loadCatalog,
  parseMode,
  fencesOverlap,
  isLifeOsId,
};
