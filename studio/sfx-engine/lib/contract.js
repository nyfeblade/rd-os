"use strict";

/**
 * Closed sets for the AI-native offline SFX toolchain.
 * Inventing a tool, code, node kind, or studio event here is a bug — extend the set first.
 */

const TOOLS = [
  "synth.patch",
  "synth.render",
  "sfx.layer",
  "sfx.process",
  "sfx.vary",
  "pack.bind",
  "pack.export",
];

const CODES = [
  "MISSING_GRAPH_IR",
  "INVALID_GRAPH",
  "UNKNOWN_NODE",
  "CYCLE",
  "UNKNOWN_TOOL",
  "INVALID_SEED",
  "UNKNOWN_PATCH",
  "UNKNOWN_EVENT",
  "UNKNOWN_ASSET",
  "UNKNOWN_PACK",
  "INVALID_PROCESS",
  "INVALID_LAYER",
  "CLOCK_STARTED_FORBIDDEN",
  "SELF_CERT",
];

const NODE_KINDS = ["osc", "noise", "env", "filter", "lfo", "fm", "am", "granular", "sample", "mix"];

const WAVES = ["sine", "square", "saw", "triangle"];

const NOISE_COLORS = ["white", "pink", "brown"];

const FILTER_MODES = ["lowpass", "highpass", "bandpass"];

const SAMPLE_WAVES = ["impulse", "click"];

const PROCESS_KINDS = ["compress", "eq", "limiter", "reverb", "transient"];

const EQ_MODES = ["peak", "lowshelf", "highshelf"];

const EXPORT_FORMATS = ["wav", "flac"];

const PACK_FORMATS = ["json", "zip"];

const LFO_TARGETS = ["hz", "gain", "q", "index", "amount"];

const STUDIO_EVENTS = [
  "ui.send",
  "ui.need_you",
  "ui.approve",
  "ui.deny",
  "ui.connect_ok",
  "ui.error",
  "ui.code_open",
  "ui.expand",
  "ui.craft_gen_done",
];

const IR_VERSION = "sfx.graph.v1";

const RANGES = {
  hz: [20, 12000],
  gain: [0, 2],
  duration_ms: [1, 2000],
  sample_rate: [8000, 96000],
  q: [0.05, 20],
  attack_ms: [0, 2000],
  decay_ms: [0, 2000],
  release_ms: [0, 2000],
  sustain: [0, 1],
  lfo_hz: [0.01, 80],
  amount: [-12000, 12000],
  index: [0, 16],
  grain_ms: [1, 80],
  density: [1, 200],
  pitch: [0.25, 4],
  jitter: [0, 1],
  pan: [-1, 1],
  offset_ms: [0, 2000],
  cooldown_ms: [0, 5000],
  n_vary: [1, 16],
  threshold: [0.01, 1],
  ratio: [1, 20],
  ceiling: [0.1, 1],
  mix: [0, 1],
  gain_db: [-24, 24],
  attack: [-1, 1],
  sustain_amt: [-1, 1],
};

const REPORT_FIELDS = [
  "ok",
  "tool",
  "code",
  "detail",
  "patch_id",
  "pack_id",
  "event_id",
  "asset_id",
  "ir",
  "seed",
  "format",
  "bytes",
  "sha256",
  "analysis",
  "falsifiers",
  "variations",
  "pack",
  "kinds_used",
  "n",
  "files",
  "verdict",
  "clock_started",
];

function report(partial) {
  const src = partial || {};
  return {
    ok: Boolean(src.ok),
    tool: src.tool || null,
    code: src.code || null,
    detail: src.detail || null,
    patch_id: src.patch_id || null,
    pack_id: src.pack_id || null,
    event_id: src.event_id || null,
    asset_id: src.asset_id || null,
    ir: src.ir || null,
    seed: src.seed == null ? null : src.seed,
    format: src.format || null,
    bytes: src.bytes == null ? null : src.bytes,
    sha256: src.sha256 || null,
    analysis: src.analysis || null,
    falsifiers: src.falsifiers || null,
    variations: src.variations || null,
    pack: src.pack || null,
    kinds_used: src.kinds_used || null,
    n: src.n == null ? null : src.n,
    files: src.files || null,
    verdict: null,
    clock_started: false,
  };
}

function fail(code, detail, extra) {
  if (!CODES.includes(code)) {
    throw new Error(`sfx-engine code not in closed set: ${code}`);
  }
  return report(Object.assign({ ok: false, code, detail: detail || code }, extra));
}

module.exports = {
  TOOLS,
  CODES,
  NODE_KINDS,
  WAVES,
  NOISE_COLORS,
  FILTER_MODES,
  SAMPLE_WAVES,
  PROCESS_KINDS,
  EQ_MODES,
  EXPORT_FORMATS,
  PACK_FORMATS,
  LFO_TARGETS,
  STUDIO_EVENTS,
  IR_VERSION,
  RANGES,
  REPORT_FIELDS,
  report,
  fail,
};
