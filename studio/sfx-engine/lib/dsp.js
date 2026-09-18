"use strict";

const { nodeType, depsOf } = require("./ir");
const { mulberry32 } = require("./rng");

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function waveform(kind, phase) {
  const p = phase - Math.floor(phase);
  switch (kind) {
    case "sine":
      return Math.sin(2 * Math.PI * p);
    case "square":
      return p < 0.5 ? 1 : -1;
    case "saw":
      return 2 * p - 1;
    case "triangle":
      return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    default:
      return Math.sin(2 * Math.PI * p);
  }
}

function hann(n) {
  const out = new Float64Array(n);
  if (n <= 1) {
    out[0] = 1;
    return out;
  }
  for (let i = 0; i < n; i += 1) {
    out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return out;
}

function white(rng, n, gain) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (rng() * 2 - 1) * gain;
  return out;
}

function pink(rng, n, gain) {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * gain;
    b6 = w * 0.115926;
  }
  return out;
}

function brown(rng, n, gain) {
  const out = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    acc += (rng() * 2 - 1) * 0.02;
    acc = clamp(acc, -1, 1);
    out[i] = acc * gain;
  }
  return out;
}

function adsr(n, sr, node) {
  let a = Math.max(1, Math.round((node.attack_ms || 0) * sr / 1000));
  let d = Math.max(1, Math.round((node.decay_ms || 0) * sr / 1000));
  let r = Math.max(1, Math.round((node.release_ms || 0) * sr / 1000));
  const s = node.sustain == null ? 0 : node.sustain;
  if (a + d + r > n) {
    const scale = n / (a + d + r);
    a = Math.max(1, Math.round(a * scale));
    d = Math.max(1, Math.round(d * scale));
    r = Math.max(1, n - a - d);
  }
  const sustainN = Math.max(0, n - a - d - r);
  const env = new Float64Array(n);
  let i = 0;
  for (let k = 0; k < a && i < n; k += 1, i += 1) env[i] = k / a;
  for (let k = 0; k < d && i < n; k += 1, i += 1) env[i] = 1 - (1 - s) * (k / d);
  for (let k = 0; k < sustainN && i < n; k += 1, i += 1) env[i] = s;
  for (let k = 0; k < r && i < n; k += 1, i += 1) env[i] = s * (1 - k / r);
  return env;
}

function biquadCoeffs(mode, hz, q, sr) {
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
    case "highpass":
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "bandpass":
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "lowpass":
    default:
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyBiquad(input, coeffsFor) {
  const out = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const c = coeffsFor(i);
    const x = input[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

function scale(buf, gain) {
  const out = new Float64Array(buf.length);
  for (let i = 0; i < buf.length; i += 1) out[i] = buf[i] * gain;
  return out;
}

function mul(a, b) {
  const n = Math.min(a.length, b.length);
  const out = new Float64Array(a.length);
  for (let i = 0; i < n; i += 1) out[i] = a[i] * b[i];
  return out;
}

function addInto(dst, src, gain) {
  const n = Math.min(dst.length, src.length);
  for (let i = 0; i < n; i += 1) dst[i] += src[i] * gain;
}

function collectLfos(nodes) {
  const map = new Map();
  for (const [id, node] of Object.entries(nodes)) {
    if (nodeType(node) !== "lfo" || !node.target) continue;
    if (!map.has(node.target)) map.set(node.target, []);
    map.get(node.target).push(id);
  }
  return map;
}

function modAt(bufs, i) {
  let sum = 0;
  for (const buf of bufs) sum += buf[i] || 0;
  return sum;
}

function renderOsc(node, n, sr, hzMod, gainMod) {
  const out = new Float64Array(n);
  const wave = node.wave || "sine";
  const baseHz = node.hz == null ? 440 : node.hz;
  const baseGain = node.gain == null ? 1 : node.gain;
  let phase = node.phase || 0;
  for (let i = 0; i < n; i += 1) {
    const hz = clamp(baseHz + modAt(hzMod, i), 0.01, sr / 2);
    const gain = baseGain * (1 + modAt(gainMod, i));
    out[i] = waveform(wave, phase) * gain;
    phase += hz / sr;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return out;
}

function renderLfo(node, n, sr) {
  const out = new Float64Array(n);
  const amount = node.amount == null ? 1 : node.amount;
  const bipolar = node.bipolar !== false;
  const wave = node.wave || "sine";
  let phase = node.phase || 0;
  const hz = node.hz == null ? 4 : node.hz;
  for (let i = 0; i < n; i += 1) {
    let w = waveform(wave, phase);
    if (!bipolar) w = (w + 1) / 2;
    out[i] = w * amount;
    phase += hz / sr;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return out;
}

function renderSample(node, n, sr, rng) {
  const out = new Float64Array(n);
  const gain = node.gain == null ? 1 : node.gain;
  if (Array.isArray(node.pcm)) {
    const len = Math.min(n, node.pcm.length);
    for (let i = 0; i < len; i += 1) out[i] = Number(node.pcm[i]) * gain;
    return out;
  }
  const wave = node.wave || "impulse";
  if (wave === "impulse") {
    out[0] = gain;
    return out;
  }
  const tau = 0.004 * sr;
  const limit = Math.min(n, Math.round(0.02 * sr));
  for (let i = 0; i < limit; i += 1) {
    out[i] = (rng() * 2 - 1) * Math.exp(-i / tau) * gain;
  }
  return out;
}

function renderGranular(source, node, n, sr, rng) {
  const out = new Float64Array(n);
  const grainN = Math.max(8, Math.round((node.grain_ms == null ? 12 : node.grain_ms) * sr / 1000));
  const density = node.density == null ? 30 : node.density;
  const pitch = node.pitch == null ? 1 : node.pitch;
  const jitter = node.jitter == null ? 0.2 : node.jitter;
  const gain = node.gain == null ? 1 : node.gain;
  const interval = Math.max(1, Math.round(sr / density));
  const window = hann(grainN);
  for (let start = 0; start < n; start += interval) {
    const srcPos = Math.floor(start + (rng() * 2 - 1) * jitter * grainN);
    for (let k = 0; k < grainN; k += 1) {
      const dst = start + k;
      if (dst < 0 || dst >= n) continue;
      const src = Math.floor(srcPos + k * pitch);
      const s = src >= 0 && src < source.length ? source[src] : 0;
      out[dst] += s * window[k] * gain;
    }
  }
  return out;
}

function modsFor(lfos, id, param, getBuf) {
  const ids = lfos.get(`${id}.${param}`) || [];
  return ids.map((lfoId) => getBuf(lfoId));
}

function renderGraph(ir, seed) {
  const sr = ir.sample_rate;
  const n = Math.max(1, Math.round((ir.duration_ms / 1000) * sr));
  const rng = mulberry32(seed >>> 0);
  const cache = new Map();
  const nodes = ir.nodes;
  const lfos = collectLfos(nodes);
  const visiting = new Set();

  function getBuf(id) {
    if (cache.has(id)) return cache.get(id);
    if (visiting.has(id)) {
      const zero = new Float64Array(n);
      cache.set(id, zero);
      return zero;
    }
    visiting.add(id);
    const node = nodes[id];
    const type = nodeType(node);
    const gain = node.gain == null ? 1 : node.gain;
    let buf;
    switch (type) {
      case "osc":
        buf = renderOsc(node, n, sr, modsFor(lfos, id, "hz", getBuf), modsFor(lfos, id, "gain", getBuf));
        break;
      case "noise": {
        const color = node.color || "white";
        if (color === "pink") buf = pink(rng, n, gain);
        else if (color === "brown") buf = brown(rng, n, gain);
        else buf = white(rng, n, gain);
        break;
      }
      case "lfo":
        buf = renderLfo(node, n, sr);
        break;
      case "sample":
        buf = renderSample(node, n, sr, rng);
        break;
      case "env": {
        const shape = adsr(n, sr, node);
        buf = node.input ? mul(getBuf(node.input), shape) : shape;
        if (node.input && gain !== 1) buf = scale(buf, gain);
        break;
      }
      case "filter": {
        const input = getBuf(node.input);
        const hzMod = modsFor(lfos, id, "hz", getBuf);
        const qMod = modsFor(lfos, id, "q", getBuf);
        const mode = node.mode || "lowpass";
        const baseHz = node.hz == null ? 1200 : node.hz;
        const baseQ = node.q == null ? 0.7 : node.q;
        let last = null;
        let lastKey = "";
        buf = applyBiquad(input, (i) => {
          const hz = clamp(baseHz + modAt(hzMod, i), 20, sr * 0.45);
          const q = clamp(baseQ + modAt(qMod, i), 0.05, 20);
          const key = `${Math.round(hz)}:${q.toFixed(3)}`;
          if (key !== lastKey) {
            last = biquadCoeffs(mode, hz, q, sr);
            lastKey = key;
          }
          return last;
        });
        if (gain !== 1) buf = scale(buf, gain);
        break;
      }
      case "fm": {
        const car = nodes[node.carrier];
        const mod = getBuf(node.modulator);
        const index = node.index == null ? 1 : node.index;
        const indexMod = modsFor(lfos, id, "index", getBuf);
        const hzMod = modsFor(lfos, node.carrier, "hz", getBuf);
        buf = new Float64Array(n);
        let phase = 0;
        const wave = car.wave || "sine";
        const baseHz = car.hz == null ? 440 : car.hz;
        const g = node.gain == null ? (car.gain == null ? 1 : car.gain) : node.gain;
        for (let i = 0; i < n; i += 1) {
          const idx = index + modAt(indexMod, i);
          buf[i] = waveform(wave, phase + idx * mod[i]) * g;
          phase += clamp(baseHz + modAt(hzMod, i), 0.01, sr / 2) / sr;
          if (phase >= 1) phase -= Math.floor(phase);
        }
        break;
      }
      case "am": {
        const car = getBuf(node.carrier);
        const mod = getBuf(node.modulator);
        const amount = node.amount == null ? 1 : node.amount;
        buf = new Float64Array(n);
        for (let i = 0; i < n; i += 1) buf[i] = car[i] * (1 + amount * mod[i]) * gain;
        break;
      }
      case "granular":
        buf = renderGranular(getBuf(node.input), node, n, sr, rng);
        break;
      case "mix": {
        buf = new Float64Array(n);
        const gains = Array.isArray(node.gains) ? node.gains : node.inputs.map(() => 1);
        for (let i = 0; i < node.inputs.length; i += 1) {
          addInto(buf, getBuf(node.inputs[i]), gains[i] == null ? 1 : gains[i]);
        }
        if (gain !== 1) buf = scale(buf, gain);
        break;
      }
      default:
        buf = new Float64Array(n);
        break;
    }
    cache.set(id, buf);
    visiting.delete(id);
    return buf;
  }

  for (const id of Object.keys(nodes)) {
    for (const dep of depsOf(nodes[id])) getBuf(dep);
  }
  const pcm = Float64Array.from(getBuf(ir.out));
  return { pcm, sample_rate: sr, duration_ms: (n / sr) * 1000 };
}

function analyze(pcm, sampleRate) {
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
    sumSq += pcm[i] * pcm[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, pcm.length));
  const duration_ms = (pcm.length / sampleRate) * 1000;
  const falsifiers = [];
  if (peak < 0.02) falsifiers.push("too_quiet");
  if (peak > 0.99) falsifiers.push("clipping");
  if (duration_ms > 120.0001) falsifiers.push("over_120ms");
  return {
    peak,
    rms,
    duration_ms,
    samples: pcm.length,
    sample_rate: sampleRate,
    falsifiers,
  };
}

module.exports = {
  renderGraph,
  analyze,
  clamp,
  waveform,
  biquadCoeffs,
  applyBiquad,
};
