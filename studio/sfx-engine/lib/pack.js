"use strict";

const { STUDIO_EVENTS, PACK_FORMATS, fail } = require("./contract");
const { inRange } = require("./ir");
const { encodeZip } = require("./encode");

function emptyPack(id) {
  return {
    id,
    events: {},
    patches: {},
  };
}

function validateBind(payload) {
  if (!payload || typeof payload !== "object") {
    return fail("UNKNOWN_PACK", "pack.bind payload must be an object");
  }
  const packId = payload.pack_id || payload.id;
  if (typeof packId !== "string" || packId.trim() === "") {
    return fail("UNKNOWN_PACK", "pack_id missing");
  }
  const eventId = payload.event_id;
  if (!STUDIO_EVENTS.includes(eventId)) {
    return fail("UNKNOWN_EVENT", `event_id=${JSON.stringify(eventId)}`);
  }
  const file = payload.file;
  if (typeof file !== "string" || (!file.endsWith(".wav") && !file.endsWith(".flac"))) {
    return fail("INVALID_GRAPH", `bind file must be wav/flac, got ${JSON.stringify(file)}`);
  }
  if (payload.gain != null && !inRange("gain", payload.gain)) {
    return fail("INVALID_GRAPH", `gain=${JSON.stringify(payload.gain)}`);
  }
  if (payload.cooldown_ms != null && !inRange("cooldown_ms", payload.cooldown_ms)) {
    return fail("INVALID_GRAPH", `cooldown_ms=${JSON.stringify(payload.cooldown_ms)}`);
  }
  return {
    ok: true,
    pack_id: packId,
    event_id: eventId,
    binding: {
      file,
      gain: payload.gain == null ? 0.7 : payload.gain,
      cooldown_ms: payload.cooldown_ms == null ? 80 : payload.cooldown_ms,
      reduced_motion_mute: payload.reduced_motion_mute === true,
    },
  };
}

function bindEvent(pack, eventId, binding, ir, assetId) {
  pack.events[eventId] = Object.assign({}, binding);
  if (assetId) pack.events[eventId].asset_id = assetId;
  if (ir) pack.patches[eventId] = ir;
  return pack;
}

function missingStudioEvents(pack) {
  return STUDIO_EVENTS.filter((id) => !pack.events[id]);
}

function publicPack(pack) {
  const events = {};
  for (const [id, row] of Object.entries(pack.events)) {
    events[id] = {
      file: row.file,
      gain: row.gain,
      cooldown_ms: row.cooldown_ms,
      reduced_motion_mute: Boolean(row.reduced_motion_mute),
    };
  }
  return {
    id: pack.id,
    events,
    patches: pack.patches,
  };
}

function exportPack(pack, format, files) {
  if (!PACK_FORMATS.includes(format)) {
    return fail("INVALID_GRAPH", `pack.export format=${JSON.stringify(format)}`);
  }
  const json = publicPack(pack);
  const jsonBuf = Buffer.from(`${JSON.stringify(json, null, 2)}\n`, "utf8");
  if (format === "json") {
    return { ok: true, format, bytes: jsonBuf.length, json, files: ["pack.json"] };
  }
  const zipFiles = [{ name: "pack.json", data: jsonBuf }].concat(files || []);
  const zip = encodeZip(zipFiles);
  return {
    ok: true,
    format: "zip",
    bytes: zip.length,
    json,
    zip,
    files: zipFiles.map((row) => row.name),
  };
}

module.exports = {
  emptyPack,
  validateBind,
  bindEvent,
  missingStudioEvents,
  publicPack,
  exportPack,
};
