"use strict";

/**
 * studio/sfx-engine — AI-native offline DSP toolchain.
 *
 * Agents call tools. Studio / other apps consume exported packs later.
 * Not a Web Audio authoring surface. Not a human mixer UI.
 *
 *   const { createEngine, call } = require("./studio/sfx-engine");
 *   createEngine().call("synth.patch", { patch })
 *
 * verdict stays null. clock_started stays false.
 */

const fs = require("fs");
const path = require("path");

const {
  TOOLS,
  CODES,
  NODE_KINDS,
  STUDIO_EVENTS,
  IR_VERSION,
  EXPORT_FORMATS,
  PACK_FORMATS,
  REPORT_FIELDS,
  PROCESS_KINDS,
  report,
  fail,
} = require("./lib/contract");
const { validate, hasGraphIR, missingGraph, kindsUsed } = require("./lib/ir");
const { toSeed } = require("./lib/rng");
const { renderGraph, analyze } = require("./lib/dsp");
const { applyChain, layerStems, varyPatch } = require("./lib/process");
const { encodeAudio, sha256 } = require("./lib/encode");
const { emptyPack, validateBind, bindEvent, missingStudioEvents, publicPack, exportPack } = require("./lib/pack");

const STARTER_PACK = path.join(__dirname, "packs", "studio.chrome.v1", "pack.json");
const EVENTS_FILE = path.join(__dirname, "events.json");

function loadJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function loadEventsCatalog() {
  return loadJson(EVENTS_FILE);
}

function loadStarterPackJson() {
  return loadJson(STARTER_PACK);
}

function pinPayload(tool, payload) {
  if (!TOOLS.includes(tool)) {
    return fail("UNKNOWN_TOOL", `tool=${JSON.stringify(tool)}`, { tool });
  }
  if (payload == null) return { ok: true, body: {} };
  if (typeof payload !== "object" || Array.isArray(payload)) {
    return fail("INVALID_GRAPH", "payload must be an object", { tool });
  }
  if (payload.clock_started === true) {
    return fail("CLOCK_STARTED_FORBIDDEN", "tools must not arm the clock", { tool });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "verdict") && payload.verdict !== null) {
    return fail("SELF_CERT", "tools must not write a verdict", { tool });
  }
  return { ok: true, body: payload };
}

function readSeed(payload) {
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "seed")) {
    return { ok: false, error: fail("INVALID_SEED", "seed is required for a deterministic render") };
  }
  const seed = toSeed(payload.seed);
  if (seed === null) return { ok: false, error: fail("INVALID_SEED", `seed=${JSON.stringify(payload.seed)}`) };
  return { ok: true, seed };
}

function createEngine() {
  const patches = new Map();
  const assets = new Map();
  const packs = new Map();
  let patchSeq = 0;
  let assetSeq = 0;

  function putPatch(ir) {
    const id = ir.id || `patch.${(patchSeq += 1)}`;
    const stored = Object.assign({}, ir, { id, version: IR_VERSION });
    patches.set(id, stored);
    return stored;
  }

  function putAsset(pcm, sampleRate, format, seed, patchId) {
    const bytes = encodeAudio(pcm, sampleRate, format);
    const analysis = analyze(pcm, sampleRate);
    const id = `asset.${(assetSeq += 1)}.${sha256(bytes).slice(0, 10)}`;
    const rec = {
      id,
      pcm,
      sample_rate: sampleRate,
      format,
      seed,
      patch_id: patchId || null,
      bytes: bytes.length,
      sha256: sha256(bytes),
      wav: format === "flac" ? null : bytes,
      audio: bytes,
      analysis,
    };
    assets.set(id, rec);
    return rec;
  }

  function resolveIr(payload) {
    if (hasGraphIR(payload)) {
      const checked = validate(payload);
      if (!checked.ok) return checked;
      return { ok: true, ir: putPatch(checked.ir) };
    }
    const patchId = payload && payload.patch_id;
    if (typeof patchId === "string" && patchId !== "") {
      if (!patches.has(patchId)) return fail("UNKNOWN_PATCH", `patch_id=${JSON.stringify(patchId)}`);
      return { ok: true, ir: patches.get(patchId) };
    }
    return missingGraph(payload);
  }

  function resolveAsset(payload) {
    if (payload && typeof payload.asset_id === "string" && payload.asset_id !== "") {
      if (!assets.has(payload.asset_id)) return fail("UNKNOWN_ASSET", `asset_id=${JSON.stringify(payload.asset_id)}`);
      return { ok: true, asset: assets.get(payload.asset_id) };
    }
    const resolved = resolveIr(payload);
    if (!resolved.ok) {
      if (resolved.code === "MISSING_GRAPH_IR" && payload && payload.asset_id) {
        return fail("UNKNOWN_ASSET", `asset_id=${JSON.stringify(payload.asset_id)}`);
      }
      return resolved;
    }
    const seeded = readSeed(payload);
    const seed = seeded.ok ? seeded.seed : 1;
    const rendered = renderGraph(resolved.ir, seed);
    const asset = putAsset(rendered.pcm, rendered.sample_rate, "wav", seed, resolved.ir.id);
    return { ok: true, asset, ir: resolved.ir };
  }

  function synthPatch(payload) {
    const checked = validate(payload);
    if (!checked.ok) return Object.assign(checked, { tool: "synth.patch" });
    const ir = putPatch(checked.ir);
    return report({
      ok: true,
      tool: "synth.patch",
      patch_id: ir.id,
      ir,
      kinds_used: kindsUsed(ir),
    });
  }

  function synthRender(payload) {
    const seeded = readSeed(payload);
    if (!seeded.ok) return Object.assign(seeded.error, { tool: "synth.render" });
    const resolved = resolveIr(payload);
    if (!resolved.ok) return Object.assign(resolved, { tool: "synth.render" });
    const format = payload.format || "wav";
    if (!EXPORT_FORMATS.includes(format)) {
      return fail("INVALID_GRAPH", `format=${JSON.stringify(format)}`, { tool: "synth.render" });
    }
    const rendered = renderGraph(resolved.ir, seeded.seed);
    const asset = putAsset(rendered.pcm, rendered.sample_rate, format, seeded.seed, resolved.ir.id);
    return report({
      ok: true,
      tool: "synth.render",
      patch_id: resolved.ir.id,
      asset_id: asset.id,
      ir: resolved.ir,
      seed: seeded.seed,
      format,
      bytes: asset.bytes,
      sha256: asset.sha256,
      analysis: asset.analysis,
      falsifiers: asset.analysis.falsifiers,
      kinds_used: kindsUsed(resolved.ir),
    });
  }

  function sfxLayer(payload) {
    const rows = payload && payload.stems;
    if (!Array.isArray(rows) || rows.length === 0) {
      return fail("INVALID_LAYER", "sfx.layer requires at least one stem", { tool: "sfx.layer" });
    }
    const stems = [];
    let sr = 48000;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const resolved = resolveAsset(Object.assign({ seed: payload.seed == null ? 1 : payload.seed }, row));
      if (!resolved.ok) return Object.assign(resolved, { tool: "sfx.layer" });
      stems.push({
        pcm: resolved.asset.pcm,
        sample_rate: resolved.asset.sample_rate,
        gain: row.gain,
        pan: row.pan,
        offset_ms: row.offset_ms,
      });
      sr = resolved.asset.sample_rate;
    }
    const mixed = layerStems(stems, sr);
    if (!mixed.ok) return Object.assign(mixed, { tool: "sfx.layer" });
    const format = payload.format || "wav";
    if (!EXPORT_FORMATS.includes(format)) {
      return fail("INVALID_GRAPH", `format=${JSON.stringify(format)}`, { tool: "sfx.layer" });
    }
    const seeded = payload.seed == null ? 1 : toSeed(payload.seed);
    const asset = putAsset(mixed.pcm, mixed.sample_rate, format, seeded === null ? 1 : seeded, null);
    return report({
      ok: true,
      tool: "sfx.layer",
      asset_id: asset.id,
      seed: asset.seed,
      format,
      bytes: asset.bytes,
      sha256: asset.sha256,
      analysis: asset.analysis,
      falsifiers: asset.analysis.falsifiers,
      n: stems.length,
    });
  }

  function sfxProcess(payload) {
    const resolved = resolveAsset(payload);
    if (!resolved.ok) return Object.assign(resolved, { tool: "sfx.process" });
    const processed = applyChain(resolved.asset.pcm, payload.chain, resolved.asset.sample_rate);
    if (!processed.ok) return Object.assign(processed, { tool: "sfx.process" });
    const format = payload.format || "wav";
    if (!EXPORT_FORMATS.includes(format)) {
      return fail("INVALID_GRAPH", `format=${JSON.stringify(format)}`, { tool: "sfx.process" });
    }
    const asset = putAsset(
      processed.pcm,
      resolved.asset.sample_rate,
      format,
      resolved.asset.seed,
      resolved.asset.patch_id
    );
    return report({
      ok: true,
      tool: "sfx.process",
      patch_id: resolved.asset.patch_id,
      asset_id: asset.id,
      seed: asset.seed,
      format,
      bytes: asset.bytes,
      sha256: asset.sha256,
      analysis: asset.analysis,
      falsifiers: asset.analysis.falsifiers,
      n: payload.chain.length,
    });
  }

  function sfxVary(payload) {
    const seeded = readSeed(payload);
    if (!seeded.ok) return Object.assign(seeded.error, { tool: "sfx.vary" });
    const resolved = resolveIr(payload);
    if (!resolved.ok) return Object.assign(resolved, { tool: "sfx.vary" });
    const n = payload.n == null ? 3 : payload.n;
    const varied = varyPatch(resolved.ir, n, seeded.seed);
    if (!varied.ok) return Object.assign(varied, { tool: "sfx.vary" });
    const format = payload.format || "wav";
    if (!EXPORT_FORMATS.includes(format)) {
      return fail("INVALID_GRAPH", `format=${JSON.stringify(format)}`, { tool: "sfx.vary" });
    }
    const variations = [];
    for (const row of varied.variations) {
      const rendered = renderGraph(row.ir, row.seed);
      const asset = putAsset(rendered.pcm, rendered.sample_rate, format, row.seed, row.ir.id);
      variations.push({
        i: row.i,
        seed: row.seed,
        patch_id: row.ir.id,
        asset_id: asset.id,
        sha256: asset.sha256,
        analysis: asset.analysis,
        falsifiers: asset.analysis.falsifiers,
      });
    }
    return report({
      ok: true,
      tool: "sfx.vary",
      patch_id: resolved.ir.id,
      seed: seeded.seed,
      format,
      n: variations.length,
      variations,
      ir: resolved.ir,
      kinds_used: kindsUsed(resolved.ir),
    });
  }

  function packBind(payload) {
    const checked = validateBind(payload);
    if (!checked.ok) return Object.assign(checked, { tool: "pack.bind" });
    if (!packs.has(checked.pack_id)) packs.set(checked.pack_id, emptyPack(checked.pack_id));
    const pack = packs.get(checked.pack_id);
    let ir = null;
    let assetId = payload.asset_id || null;
    if (hasGraphIR(payload) || payload.patch_id) {
      const resolved = resolveIr(payload);
      if (!resolved.ok) return Object.assign(resolved, { tool: "pack.bind" });
      ir = resolved.ir;
    }
    if (assetId && !assets.has(assetId)) {
      return fail("UNKNOWN_ASSET", `asset_id=${JSON.stringify(assetId)}`, { tool: "pack.bind" });
    }
    if (!assetId && ir && payload.render !== false) {
      const seed = payload.seed == null ? 1 : toSeed(payload.seed);
      if (payload.seed != null && seed === null) {
        return fail("INVALID_SEED", `seed=${JSON.stringify(payload.seed)}`, { tool: "pack.bind" });
      }
      const rendered = renderGraph(ir, seed === null ? 1 : seed);
      const format = (checked.binding.file.endsWith(".flac") && "flac") || "wav";
      const asset = putAsset(rendered.pcm, rendered.sample_rate, format, seed === null ? 1 : seed, ir.id);
      assetId = asset.id;
    }
    bindEvent(pack, checked.event_id, checked.binding, ir, assetId);
    return report({
      ok: true,
      tool: "pack.bind",
      pack_id: checked.pack_id,
      event_id: checked.event_id,
      patch_id: ir ? ir.id : null,
      asset_id: assetId,
      ir,
      pack: publicPack(pack),
    });
  }

  function renderBoundAsset(pack, eventId) {
    const row = pack.events[eventId];
    if (row.asset_id && assets.has(row.asset_id)) return assets.get(row.asset_id);
    const ir = pack.patches[eventId];
    if (!ir) return null;
    const rendered = renderGraph(ir, 1);
    const format = row.file.endsWith(".flac") ? "flac" : "wav";
    return putAsset(rendered.pcm, rendered.sample_rate, format, 1, ir.id);
  }

  function packExport(payload) {
    const packId = payload.pack_id || payload.id;
    if (typeof packId !== "string" || !packs.has(packId)) {
      return fail("UNKNOWN_PACK", `pack_id=${JSON.stringify(packId)}`, { tool: "pack.export" });
    }
    const format = payload.format || "json";
    if (!PACK_FORMATS.includes(format)) {
      return fail("INVALID_GRAPH", `format=${JSON.stringify(format)}`, { tool: "pack.export" });
    }
    const pack = packs.get(packId);
    const files = [];
    if (format === "zip") {
      for (const eventId of Object.keys(pack.events)) {
        const row = pack.events[eventId];
        const asset = renderBoundAsset(pack, eventId);
        if (!asset) {
          return fail("UNKNOWN_ASSET", `event ${eventId} has no asset or patch`, { tool: "pack.export" });
        }
        files.push({ name: row.file, data: asset.audio });
      }
    }
    const exported = exportPack(pack, format, files);
    if (!exported.ok) return Object.assign(exported, { tool: "pack.export" });
    return report({
      ok: true,
      tool: "pack.export",
      pack_id: packId,
      format: exported.format,
      bytes: exported.bytes,
      sha256: exported.zip ? sha256(exported.zip) : sha256(Buffer.from(JSON.stringify(exported.json))),
      pack: exported.json,
      files: exported.files,
      n: Object.keys(pack.events).length,
    });
  }

  function loadStarter() {
    const json = loadStarterPackJson();
    const pack = emptyPack(json.id || "pack.studio.chrome.v1");
    packs.set(pack.id, pack);
    for (const eventId of STUDIO_EVENTS) {
      const ir = json.patches && json.patches[eventId];
      const binding = (json.events && json.events[eventId]) || {
        file: `${eventId.replace(/\./g, "_")}.wav`,
        gain: 0.7,
        cooldown_ms: 80,
        reduced_motion_mute: false,
      };
      const payload = Object.assign({ pack_id: pack.id, event_id: eventId }, binding, { patch: ir, seed: 1 });
      const result = packBind(payload);
      if (!result.ok) return result;
    }
    return report({
      ok: true,
      tool: "pack.bind",
      pack_id: pack.id,
      pack: publicPack(pack),
      n: STUDIO_EVENTS.length,
    });
  }

  function call(tool, payload) {
    const pinned = pinPayload(tool, payload);
    if (!pinned.ok) return pinned;
    const body = pinned.body;
    switch (tool) {
      case "synth.patch":
        return synthPatch(body);
      case "synth.render":
        return synthRender(body);
      case "sfx.layer":
        return sfxLayer(body);
      case "sfx.process":
        return sfxProcess(body);
      case "sfx.vary":
        return sfxVary(body);
      case "pack.bind":
        return packBind(body);
      case "pack.export":
        return packExport(body);
      default:
        return fail("UNKNOWN_TOOL", `tool=${JSON.stringify(tool)}`, { tool });
    }
  }

  return {
    call,
    loadStarter,
    missingStudioEvents: (packId) => missingStudioEvents(packs.get(packId) || emptyPack(packId)),
    getPatch: (id) => patches.get(id) || null,
    getAsset: (id) => assets.get(id) || null,
    getPack: (id) => (packs.has(id) ? publicPack(packs.get(id)) : null),
    getAudio: (id) => (assets.has(id) ? assets.get(id).audio : null),
  };
}

const defaultEngine = createEngine();

function call(tool, payload) {
  return defaultEngine.call(tool, payload);
}

module.exports = {
  createEngine,
  call,
  TOOLS,
  CODES,
  NODE_KINDS,
  STUDIO_EVENTS,
  IR_VERSION,
  REPORT_FIELDS,
  PROCESS_KINDS,
  EXPORT_FORMATS,
  PACK_FORMATS,
  loadEventsCatalog,
  loadStarterPackJson,
};
