"use strict";

const fs = require("fs");
const path = require("path");
const { REQUIRED_EVENTS } = require("./events");

const PACK_ID = "pack.studio.chrome.v1";
const DEFAULT_PACK_DIR = path.resolve(__dirname, "..", "craft", "packs", "studio-chrome-v1");

function loadPack(dir) {
  const packDir = path.resolve(dir || DEFAULT_PACK_DIR);
  let raw;
  try {
    raw = fs.readFileSync(path.join(packDir, "pack.json"), "utf8");
  } catch {
    return { ok: false, reason: "missing_pack", dir: packDir, id: null, events: {}, patches: {} };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_pack", dir: packDir, id: null, events: {}, patches: {} };
  }

  if (!data || typeof data !== "object" || typeof data.id !== "string" || !data.events || typeof data.events !== "object") {
    return { ok: false, reason: "invalid_pack", dir: packDir, id: null, events: {}, patches: {} };
  }

  return {
    ok: true,
    reason: null,
    id: data.id,
    events: data.events,
    patches: data.patches && typeof data.patches === "object" ? data.patches : {},
    dir: packDir,
  };
}

function bindingOf(pack, eventId) {
  if (!pack || !pack.events || typeof eventId !== "string") return null;
  const row = pack.events[eventId];
  if (!row || typeof row !== "object" || typeof row.file !== "string" || row.file === "") return null;
  return {
    file: row.file,
    gain: typeof row.gain === "number" ? row.gain : 1,
    cooldown_ms: typeof row.cooldown_ms === "number" ? row.cooldown_ms : 80,
    reduced_motion_mute: row.reduced_motion_mute === true,
  };
}

function assetPath(pack, eventId) {
  const binding = bindingOf(pack, eventId);
  if (!binding || !pack || typeof pack.dir !== "string") return null;
  return path.join(pack.dir, binding.file);
}

function assetUrl(pack, eventId, packUrl) {
  const binding = bindingOf(pack, eventId);
  if (!binding) return null;
  if (typeof packUrl === "string" && packUrl !== "") {
    const base = packUrl.endsWith("/") ? packUrl : `${packUrl}/`;
    return base + binding.file.replace(/^\.?\//, "");
  }
  const abs = assetPath(pack, eventId);
  if (!abs) return null;
  return pathToFileUrl(abs);
}

function pathToFileUrl(abs) {
  const resolved = path.resolve(abs);
  if (process.platform === "win32") {
    return `file:///${resolved.replace(/\\/g, "/")}`;
  }
  return `file://${resolved}`;
}

function missingRequiredEvents(pack) {
  if (!pack || !pack.events) return REQUIRED_EVENTS.slice();
  return REQUIRED_EVENTS.filter((id) => !bindingOf(pack, id));
}

module.exports = {
  PACK_ID,
  DEFAULT_PACK_DIR,
  loadPack,
  bindingOf,
  assetPath,
  assetUrl,
  pathToFileUrl,
  missingRequiredEvents,
};
