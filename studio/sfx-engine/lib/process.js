"use strict";

const { PROCESS_KINDS, EQ_MODES, RANGES, fail } = require("./contract");
const { clamp, applyBiquad } = require("./dsp");
const { mixSeed, mulberry32 } = require("./rng");
const { inRange } = require("./ir");

function copyPcm(pcm) {
  return Float64Array.from(pcm);
}

function peakFollower(pcm, sr, attackMs, releaseMs) {
  const atk = Math.exp(-1 / Math.max(1, (attackMs / 1000) * sr));
  const rel = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * sr));
  const env = new Float64Array(pcm.length);
  let e = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const x = Math.abs(pcm[i]);
    const coeff = x > e ? atk : rel;
    e = coeff * e + (1 - coeff) * x;
    env[i] = e;
  }
  return env;
}

function compress(pcm, node, sr) {
  const threshold = node.threshold == null ? 0.5 : node.threshold;
  const ratio = node.ratio == null ? 4 : node.ratio;
  const env = peakFollower(pcm, sr, node.attack_ms == null ? 3 : node.attack_ms, node.release_ms == null ? 40 : node.release_ms);
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    let gain = 1;
    if (env[i] > threshold) {
      const over = threshold + (env[i] - threshold) / ratio;
      gain = over / Math.max(env[i], 1e-9);
    }
    out[i] = pcm[i] * gain;
  }
  return out;
}

function limiter(pcm, node) {
  const ceiling = node.ceiling == null ? 0.95 : node.ceiling;
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  const gain = peak > ceiling ? ceiling / peak : 1;
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) out[i] = pcm[i] * gain;
  return out;
}

function eq(pcm, node, sr) {
  const mode = node.mode || "peak";
  const hz = node.hz == null ? 1200 : node.hz;
  const q = node.q == null ? 0.8 : node.q;
  const gainDb = node.gain_db == null ? 0 : node.gain_db;
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * clamp(hz, 20, sr * 0.45)) / sr;
  const alpha = Math.sin(w0) / (2 * Math.max(0.05, q));
  const cos = Math.cos(w0);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  switch (mode) {
    case "lowshelf":
      b0 = A * (A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
      a0 = A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
      break;
    case "highshelf":
      b0 = A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
      a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
      break;
    case "peak":
    default:
      b0 = 1 + alpha * A;
      b1 = -2 * cos;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cos;
      a2 = 1 - alpha / A;
      break;
  }
  const coeffs = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  return applyBiquad(pcm, () => coeffs);
}

function comb(pcm, delay, feedback) {
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    const prev = i >= delay ? out[i - delay] : 0;
    out[i] = pcm[i] + prev * feedback;
  }
  return out;
}

function allpass(pcm, delay, gain) {
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    const d = i >= delay ? pcm[i - delay] : 0;
    const y = i >= delay ? out[i - delay] : 0;
    out[i] = -gain * pcm[i] + d + gain * y;
  }
  return out;
}

function reverb(pcm, node, sr) {
  const mix = node.mix == null ? 0.2 : node.mix;
  const decay = node.decay_ms == null ? 80 : node.decay_ms;
  const feedback = clamp(decay / 250, 0.1, 0.85);
  const delays = [1559, 1613, 1741, 1867].map((d) => Math.max(2, Math.round(d * sr / 48000)));
  const wet = new Float64Array(pcm.length);
  for (const delay of delays) {
    const c = comb(pcm, delay, feedback);
    for (let i = 0; i < pcm.length; i += 1) wet[i] += c[i] * 0.25;
  }
  let ap = allpass(wet, Math.max(2, Math.round(225 * sr / 48000)), 0.5);
  ap = allpass(ap, Math.max(2, Math.round(341 * sr / 48000)), 0.5);
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) out[i] = pcm[i] * (1 - mix) + ap[i] * mix;
  return out;
}

function transient(pcm, node, sr) {
  const attack = node.attack == null ? 0.3 : node.attack;
  const sustain = node.sustain == null ? 0 : node.sustain;
  const fast = peakFollower(pcm, sr, 1, 20);
  const slow = peakFollower(pcm, sr, 15, 80);
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    const diff = fast[i] - slow[i];
    const sign = pcm[i] < 0 ? -1 : 1;
    const atk = diff > 0 ? attack * diff : 0;
    const sus = diff < 0 ? sustain * -diff : 0;
    out[i] = pcm[i] + sign * (atk + sus);
  }
  return out;
}

function validateStep(step, index) {
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    return fail("INVALID_PROCESS", `chain[${index}] is not an object`);
  }
  const type = step.type || step.kind;
  if (!PROCESS_KINDS.includes(type)) {
    return fail("INVALID_PROCESS", `chain[${index}] type=${JSON.stringify(type)}`);
  }
  if (type === "eq" && step.mode && !EQ_MODES.includes(step.mode)) {
    return fail("INVALID_PROCESS", `chain[${index}] eq mode=${JSON.stringify(step.mode)}`);
  }
  const checks = [
    ["threshold", "threshold"],
    ["ratio", "ratio"],
    ["ceiling", "ceiling"],
    ["mix", "mix"],
    ["gain_db", "gain_db"],
    ["attack", "attack"],
    ["sustain", "sustain_amt"],
    ["hz", "hz"],
    ["q", "q"],
    ["attack_ms", "attack_ms"],
    ["release_ms", "release_ms"],
    ["decay_ms", "decay_ms"],
  ];
  for (const [field, range] of checks) {
    if (step[field] != null && !inRange(range, step[field])) {
      return fail("INVALID_PROCESS", `chain[${index}].${field}=${JSON.stringify(step[field])}`);
    }
  }
  return null;
}

function applyChain(pcm, chain, sr) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return fail("INVALID_PROCESS", "sfx.process requires a DSP chain");
  }
  let next = copyPcm(pcm);
  for (let i = 0; i < chain.length; i += 1) {
    const step = chain[i];
    const bad = validateStep(step, i);
    if (bad) return bad;
    const type = step.type || step.kind;
    switch (type) {
      case "compress":
        next = compress(next, step, sr);
        break;
      case "eq":
        next = eq(next, step, sr);
        break;
      case "limiter":
        next = limiter(next, step);
        break;
      case "reverb":
        next = reverb(next, step, sr);
        break;
      case "transient":
        next = transient(next, step, sr);
        break;
      default:
        return fail("INVALID_PROCESS", `chain[${i}] type=${JSON.stringify(type)}`);
    }
  }
  return { ok: true, pcm: next };
}

function layerStems(stems, defaultRate) {
  if (!Array.isArray(stems) || stems.length === 0) {
    return fail("INVALID_LAYER", "sfx.layer requires at least one stem");
  }
  let maxLen = 0;
  let sr = defaultRate || 48000;
  for (let i = 0; i < stems.length; i += 1) {
    const stem = stems[i];
    if (!stem || typeof stem !== "object") {
      return fail("INVALID_LAYER", `stems[${i}] is not an object`);
    }
    if (!stem.pcm || typeof stem.pcm.length !== "number") {
      return fail("INVALID_LAYER", `stems[${i}] has no PCM`);
    }
    if (stem.gain != null && !inRange("gain", stem.gain)) {
      return fail("INVALID_LAYER", `stems[${i}].gain=${JSON.stringify(stem.gain)}`);
    }
    if (stem.pan != null && !inRange("pan", stem.pan)) {
      return fail("INVALID_LAYER", `stems[${i}].pan=${JSON.stringify(stem.pan)}`);
    }
    if (stem.offset_ms != null && !inRange("offset_ms", stem.offset_ms)) {
      return fail("INVALID_LAYER", `stems[${i}].offset_ms=${JSON.stringify(stem.offset_ms)}`);
    }
    if (stem.sample_rate) sr = stem.sample_rate;
    const offset = Math.round(((stem.offset_ms || 0) / 1000) * sr);
    const len = offset + stem.pcm.length;
    if (len > maxLen) maxLen = len;
  }

  const left = new Float64Array(maxLen);
  const right = new Float64Array(maxLen);
  for (const stem of stems) {
    const offset = Math.round(((stem.offset_ms || 0) / 1000) * (stem.sample_rate || sr));
    const gain = stem.gain == null ? 1 : stem.gain;
    const pan = stem.pan == null ? 0 : clamp(stem.pan, -1, 1);
    const lg = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const rg = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < stem.pcm.length; i += 1) {
      left[offset + i] += stem.pcm[i] * lg;
      right[offset + i] += stem.pcm[i] * rg;
    }
  }
  const pcm = new Float64Array(maxLen);
  for (let i = 0; i < maxLen; i += 1) pcm[i] = 0.5 * (left[i] + right[i]);
  return { ok: true, pcm, sample_rate: sr };
}

function perturbNodes(nodes, rng) {
  const next = JSON.parse(JSON.stringify(nodes));
  for (const node of Object.values(next)) {
    if (typeof node.hz === "number") {
      node.hz = clamp(node.hz * (1 + (rng() * 2 - 1) * 0.04), RANGES.hz[0], RANGES.hz[1]);
    }
    if (typeof node.gain === "number") {
      node.gain = clamp(node.gain * (1 + (rng() * 2 - 1) * 0.06), RANGES.gain[0], RANGES.gain[1]);
    }
    if (typeof node.q === "number") {
      node.q = clamp(node.q * (1 + (rng() * 2 - 1) * 0.1), RANGES.q[0], RANGES.q[1]);
    }
    if (typeof node.index === "number") {
      node.index = clamp(node.index * (1 + (rng() * 2 - 1) * 0.08), RANGES.index[0], RANGES.index[1]);
    }
    if (typeof node.density === "number") {
      node.density = clamp(node.density * (1 + (rng() * 2 - 1) * 0.1), RANGES.density[0], RANGES.density[1]);
    }
    if (typeof node.amount === "number") {
      node.amount = clamp(node.amount * (1 + (rng() * 2 - 1) * 0.05), RANGES.amount[0], RANGES.amount[1]);
    }
  }
  return next;
}

function varyPatch(ir, n, seed) {
  if (!inRange("n_vary", n)) {
    return fail("INVALID_GRAPH", `n=${JSON.stringify(n)}`);
  }
  const variations = [];
  for (let i = 0; i < n; i += 1) {
    const nextSeed = mixSeed(seed, i + 1);
    const rng = mulberry32(nextSeed);
    variations.push({
      i,
      seed: nextSeed,
      ir: Object.assign({}, ir, {
        id: `${ir.id || "patch"}.v${i}`,
        nodes: perturbNodes(ir.nodes, rng),
      }),
    });
  }
  return { ok: true, variations };
}

module.exports = {
  applyChain,
  layerStems,
  varyPatch,
  validateStep,
};
