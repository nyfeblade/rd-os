"use strict";

const {
  NODE_KINDS,
  WAVES,
  NOISE_COLORS,
  FILTER_MODES,
  SAMPLE_WAVES,
  LFO_TARGETS,
  IR_VERSION,
  RANGES,
  fail,
} = require("./contract");

function inRange(name, value) {
  const pair = RANGES[name];
  if (!pair) return typeof value === "number" && Number.isFinite(value);
  return typeof value === "number" && Number.isFinite(value) && value >= pair[0] && value <= pair[1];
}

function looksLikeChat(payload) {
  if (!payload || typeof payload !== "object") return false;
  const keys = ["prompt", "text", "chat", "description", "whoosh"];
  return keys.some((key) => typeof payload[key] === "string" && payload[key].trim() !== "");
}

function rawGraph(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.patch && typeof payload.patch === "object" && !Array.isArray(payload.patch)) {
    return payload.patch;
  }
  if (payload.nodes || payload.graph) return payload;
  return null;
}

function graphNodes(graph) {
  if (!graph || typeof graph !== "object") return null;
  const nodes = graph.nodes || graph.graph;
  if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) return null;
  return nodes;
}

function hasGraphIR(payload) {
  const nodes = graphNodes(rawGraph(payload));
  return Boolean(nodes && Object.keys(nodes).length > 0);
}

function missingGraph(payload, extra) {
  const hint = looksLikeChat(payload)
    ? "chat/prompt whoosh is not a patch; graph IR is required"
    : "synth.patch requires versioned graph IR (nodes + out)";
  return fail("MISSING_GRAPH_IR", hint, extra);
}

function nodeType(node) {
  if (!node || typeof node !== "object") return "";
  return String(node.type || node.kind || "");
}

function depsOf(node) {
  const type = nodeType(node);
  switch (type) {
    case "osc":
    case "noise":
    case "lfo":
    case "sample":
      return [];
    case "env":
    case "filter":
    case "granular":
      return node.input ? [String(node.input)] : [];
    case "fm":
      return node.modulator ? [String(node.modulator)] : [];
    case "am":
      return [node.carrier, node.modulator].filter(Boolean).map(String);
    case "mix":
      return Array.isArray(node.inputs) ? node.inputs.map(String) : [];
    default:
      return [];
  }
}

function walkCycles(nodes) {
  const state = new Map();
  const stack = [];

  function visit(id) {
    const mark = state.get(id);
    if (mark === "done") return null;
    if (mark === "open") return stack.concat(id);
    state.set(id, "open");
    stack.push(id);
    const node = nodes[id];
    if (node) {
      for (const dep of depsOf(node)) {
        const cycle = visit(dep);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(id, "done");
    return null;
  }

  for (const id of Object.keys(nodes)) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function checkRange(label, rangeName, value) {
  if (value == null) return null;
  if (!inRange(rangeName, value)) {
    return fail("INVALID_GRAPH", `${label} out of range ${rangeName}=${JSON.stringify(value)}`);
  }
  return null;
}

function validateNode(id, node, nodes) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return fail("INVALID_GRAPH", `node ${id} is not an object`);
  }
  const type = nodeType(node);
  if (!NODE_KINDS.includes(type)) {
    return fail("UNKNOWN_NODE", `node ${id} type=${JSON.stringify(type)}`);
  }

  const badGain = checkRange(`${id}.gain`, "gain", node.gain);
  if (badGain) return badGain;

  switch (type) {
    case "osc": {
      if (!WAVES.includes(node.wave || "sine")) {
        return fail("INVALID_GRAPH", `node ${id} wave=${JSON.stringify(node.wave)}`);
      }
      if (!inRange("hz", node.hz == null ? 440 : node.hz)) {
        return fail("INVALID_GRAPH", `node ${id} hz=${JSON.stringify(node.hz)}`);
      }
      return null;
    }
    case "noise": {
      if (!NOISE_COLORS.includes(node.color || "white")) {
        return fail("INVALID_GRAPH", `node ${id} color=${JSON.stringify(node.color)}`);
      }
      return null;
    }
    case "env": {
      for (const [field, range] of [
        ["attack_ms", "attack_ms"],
        ["decay_ms", "decay_ms"],
        ["release_ms", "release_ms"],
        ["sustain", "sustain"],
      ]) {
        const bad = checkRange(`${id}.${field}`, range, node[field]);
        if (bad) return bad;
      }
      if (node.input && !nodes[node.input]) {
        return fail("INVALID_GRAPH", `node ${id} input=${JSON.stringify(node.input)} missing`);
      }
      return null;
    }
    case "filter": {
      if (!FILTER_MODES.includes(node.mode || "lowpass")) {
        return fail("INVALID_GRAPH", `node ${id} mode=${JSON.stringify(node.mode)}`);
      }
      if (!inRange("hz", node.hz == null ? 1200 : node.hz)) {
        return fail("INVALID_GRAPH", `node ${id} hz=${JSON.stringify(node.hz)}`);
      }
      if (!inRange("q", node.q == null ? 0.7 : node.q)) {
        return fail("INVALID_GRAPH", `node ${id} q=${JSON.stringify(node.q)}`);
      }
      if (!node.input || !nodes[node.input]) {
        return fail("INVALID_GRAPH", `node ${id} filter input missing`);
      }
      return null;
    }
    case "lfo": {
      if (!WAVES.includes(node.wave || "sine")) {
        return fail("INVALID_GRAPH", `node ${id} wave=${JSON.stringify(node.wave)}`);
      }
      if (!inRange("lfo_hz", node.hz == null ? 4 : node.hz)) {
        return fail("INVALID_GRAPH", `node ${id} hz=${JSON.stringify(node.hz)}`);
      }
      if (!inRange("amount", node.amount == null ? 1 : node.amount)) {
        return fail("INVALID_GRAPH", `node ${id} amount=${JSON.stringify(node.amount)}`);
      }
      if (node.target) {
        const parts = String(node.target).split(".");
        if (parts.length !== 2 || !nodes[parts[0]] || !LFO_TARGETS.includes(parts[1])) {
          return fail("INVALID_GRAPH", `node ${id} target=${JSON.stringify(node.target)}`);
        }
        if (parts[0] === id) return fail("CYCLE", `lfo ${id} targets itself`);
      }
      return null;
    }
    case "fm": {
      if (!node.carrier || !nodes[node.carrier]) {
        return fail("INVALID_GRAPH", `node ${id} fm carrier missing`);
      }
      if (nodeType(nodes[node.carrier]) !== "osc") {
        return fail("INVALID_GRAPH", `node ${id} fm carrier must be osc`);
      }
      if (!node.modulator || !nodes[node.modulator]) {
        return fail("INVALID_GRAPH", `node ${id} fm modulator missing`);
      }
      if (!inRange("index", node.index == null ? 1 : node.index)) {
        return fail("INVALID_GRAPH", `node ${id} index=${JSON.stringify(node.index)}`);
      }
      return null;
    }
    case "am": {
      if (!node.carrier || !nodes[node.carrier]) {
        return fail("INVALID_GRAPH", `node ${id} am carrier missing`);
      }
      if (!node.modulator || !nodes[node.modulator]) {
        return fail("INVALID_GRAPH", `node ${id} am modulator missing`);
      }
      if (!inRange("amount", node.amount == null ? 1 : node.amount)) {
        return fail("INVALID_GRAPH", `node ${id} amount=${JSON.stringify(node.amount)}`);
      }
      return null;
    }
    case "granular": {
      if (!node.input || !nodes[node.input]) {
        return fail("INVALID_GRAPH", `node ${id} granular input missing`);
      }
      for (const [field, range] of [
        ["grain_ms", "grain_ms"],
        ["density", "density"],
        ["pitch", "pitch"],
        ["jitter", "jitter"],
      ]) {
        const bad = checkRange(`${id}.${field}`, range, node[field]);
        if (bad) return bad;
      }
      return null;
    }
    case "sample": {
      if (Array.isArray(node.pcm)) {
        if (node.pcm.length === 0) return fail("INVALID_GRAPH", `node ${id} pcm is empty`);
        return null;
      }
      if (!SAMPLE_WAVES.includes(node.wave || "impulse")) {
        return fail("INVALID_GRAPH", `node ${id} wave=${JSON.stringify(node.wave)}`);
      }
      return null;
    }
    case "mix": {
      if (!Array.isArray(node.inputs) || node.inputs.length === 0) {
        return fail("INVALID_GRAPH", `node ${id} mix inputs missing`);
      }
      for (const input of node.inputs) {
        if (!nodes[input]) return fail("INVALID_GRAPH", `node ${id} mix input ${input} missing`);
      }
      if (node.gains && (!Array.isArray(node.gains) || node.gains.length !== node.inputs.length)) {
        return fail("INVALID_GRAPH", `node ${id} mix gains must match inputs`);
      }
      return null;
    }
    default: {
      const exhaustive = type;
      return fail("UNKNOWN_NODE", `node ${id} type=${JSON.stringify(exhaustive)}`);
    }
  }
}

function normalize(graph, idHint) {
  const nodes = graphNodes(graph);
  const out = graph.out || (nodes && nodes.out ? "out" : null);
  const kinds = [];
  const seen = new Set();
  if (nodes) {
    for (const node of Object.values(nodes)) {
      const type = nodeType(node);
      if (type && !seen.has(type)) {
        seen.add(type);
        kinds.push(type);
      }
    }
  }
  kinds.sort();
  return {
    version: IR_VERSION,
    id: graph.id || idHint || null,
    sample_rate: graph.sample_rate == null ? 48000 : graph.sample_rate,
    duration_ms: graph.duration_ms == null ? 100 : graph.duration_ms,
    nodes,
    out,
    kinds_used: kinds,
  };
}

function validate(payload, idHint) {
  if (!hasGraphIR(payload)) return missingGraph(payload);
  const graph = rawGraph(payload);
  const ir = normalize(graph, idHint);
  if (!inRange("sample_rate", ir.sample_rate)) {
    return fail("INVALID_GRAPH", `sample_rate=${JSON.stringify(ir.sample_rate)}`);
  }
  if (!inRange("duration_ms", ir.duration_ms)) {
    return fail("INVALID_GRAPH", `duration_ms=${JSON.stringify(ir.duration_ms)}`);
  }
  if (!ir.out || !ir.nodes[ir.out]) {
    return fail("INVALID_GRAPH", "graph.out must name a node");
  }

  for (const [id, node] of Object.entries(ir.nodes)) {
    const bad = validateNode(id, node, ir.nodes);
    if (bad) return bad;
  }

  const cycle = walkCycles(ir.nodes);
  if (cycle) return fail("CYCLE", `cycle ${cycle.join("→")}`);

  return { ok: true, ir };
}

function kindsUsed(ir) {
  return ir && Array.isArray(ir.kinds_used) ? ir.kinds_used : [];
}

module.exports = {
  hasGraphIR,
  looksLikeChat,
  missingGraph,
  rawGraph,
  graphNodes,
  nodeType,
  depsOf,
  validate,
  normalize,
  kindsUsed,
  inRange,
};
