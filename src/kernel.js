"use strict";

const { createStore } = require("./store");
const { buildAttentionDump, HARD_LAW } = require("./attention");

const TOOLS = [
  "experiment.open",
  "experiment.record_actuals",
  "envelope.query",
  "envelope.record",
  "plan.fanout",
  "plan.accept",
  "claim.submit",
  "claim.verdict_draft",
  "attention.dump",
  "steer.gate",
];

const GATE_KINDS = new Set([
  "merge",
  "proof_accept",
  "quota_unfreeze",
  "scope_change",
  "physical_access",
  "legal",
  "other",
]);

const BANNED_TIME_KEYS = new Set([
  "estimate_weeks",
  "human_weeks",
  "estimate_human_weeks",
  "sprints",
]);

const WEEK_TOKEN = /\b(weeks?|sprints?|human_week)\b/i;
const WEIGHT_ONLY_TOKEN = /\b(lgtm|looks good|confidence|probability|stars|i am \d+% sure|high)\b|Δ|\bdelta\b/i;
const README_INSTRUMENT = /\breadme\b|\bskill\.md\b|\bskill theater\b/i;

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNeverTool(tool) {
  throw new Error(`unhandled McpTool: ${tool}`);
}

function assertNeverReject(code) {
  throw new Error(`unhandled RejectCode: ${code}`);
}

function createKernel(home) {
  const store = createStore(home);

  function dispatch(tool, payload, ctx) {
    const body = payload && typeof payload === "object" ? payload : {};
    const actor = ctx && ctx.actor ? ctx.actor : "agent";
    switch (tool) {
      case "experiment.open":
        return experimentOpen(body);
      case "experiment.record_actuals":
        return experimentRecordActuals(body);
      case "envelope.query":
        return envelopeQuery(body);
      case "envelope.record":
        return envelopeRecord(body);
      case "plan.fanout":
        return planFanout(body);
      case "plan.accept":
        return planAccept(body);
      case "claim.submit":
        return claimSubmit(body);
      case "claim.verdict_draft":
        return claimVerdictDraft(body);
      case "attention.dump":
        return attentionDump();
      case "steer.gate":
        return steerGate(body, actor);
      default:
        if (TOOLS.includes(tool)) {
          return assertNeverTool(tool);
        }
        return reject("UNKNOWN_TOOL", `unknown tool: ${tool}`);
    }
  }

  function experimentOpen(payload) {
    const machine = requireMachineTime(payload);
    if (!machine.ok) {
      return machine;
    }
    const week = rejectWeekWithoutGate(payload);
    if (week) {
      return week;
    }
    if (typeof payload.experiment_id !== "string" || !payload.experiment_id.trim()) {
      return reject("MISSING_MACHINE_TIME", "experiment_id is required on the packet");
    }
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      return reject("MISSING_MACHINE_TIME", "title is required on the packet");
    }

    const existing = store.loadExperiment(payload.experiment_id);
    if (existing && existing.stage !== "finished" && existing.stage !== "killed") {
      const shrink = detectShrink(existing, payload, payload.constraint || null);
      if (shrink) {
        return shrink;
      }
    }

    const experiment = {
      experiment_id: payload.experiment_id.trim(),
      title: payload.title.trim(),
      stage: "open",
      estimate_ca_hours: payload.estimate_ca_hours,
      estimate_proof_min: payload.estimate_proof_min,
      human_gates: payload.human_gates.map(normalizeGate),
      actuals: {
        ca_hours: payload.actuals.ca_hours,
        proof_min: payload.actuals.proof_min,
        human_hours: payload.actuals.human_hours,
        finished_at: payload.actuals.finished_at,
      },
      fanout: null,
      envelope_query_id: null,
      opened_n: payload.opened_n || payload.n || null,
      kill: payload.kill || null,
      instrument: payload.instrument || null,
      opened_at: new Date().toISOString(),
    };

    const packetUri = store.saveExperiment(experiment);
    persistAttention();
    return ok({
      experiment,
      packet_uri: packetUri,
    });
  }

  function experimentRecordActuals(payload) {
    const experiment = loadRequiredExperiment(payload.experiment_id);
    if (!experiment.ok) {
      return experiment;
    }
    const exp = experiment.data;
    if (!payload.actuals || typeof payload.actuals !== "object") {
      return reject("MISSING_ACTUALS", "actuals object is required");
    }
    if (typeof payload.actuals.ca_hours !== "number" || typeof payload.actuals.proof_min !== "number") {
      return reject("MISSING_ACTUALS", "actuals.ca_hours and actuals.proof_min must be numbers");
    }
    const week = rejectWeekWithoutGate({ ...exp, actuals: payload.actuals, human_gates: exp.human_gates });
    if (week) {
      return week;
    }
    if (payload.actuals.human_hours != null && !(exp.human_gates || []).length) {
      return reject("HUMAN_WEEK_WITHOUT_GATE", "human hours require a listed human gate");
    }
    exp.actuals = {
      ca_hours: payload.actuals.ca_hours,
      proof_min: payload.actuals.proof_min,
      human_hours: payload.actuals.human_hours == null ? null : payload.actuals.human_hours,
      finished_at: payload.actuals.finished_at || new Date().toISOString(),
    };
    if (payload.finished === true || payload.stage === "finished") {
      exp.stage = "finished";
    }
    const packetUri = store.saveExperiment(exp);
    persistAttention();
    return ok({ experiment: exp, packet_uri: packetUri });
  }

  function envelopeQuery(payload) {
    const baselines = store.listBaselines();
    const similar = payload.similar || payload.experiment_id || payload.title || null;
    let nearest = null;
    if (baselines.length) {
      nearest = baselines[baselines.length - 1];
      if (similar) {
        const hit = baselines.find((row) => row.experiment_id === similar || row.title === similar);
        if (hit) {
          nearest = hit;
        }
      }
    }
    const query = {
      id: `enq-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      similar,
      at: new Date().toISOString(),
    };
    store.recordEnvelopeQuery(query);
    const data = {
      query_id: query.id,
      baselines,
      nearest,
    };
    if (!baselines.length || (nearest && nearest.actuals_ca_hours == null)) {
      data.code = "NO_BASELINE";
    }
    return ok(data);
  }

  function envelopeRecord(payload) {
    const experiment = loadRequiredExperiment(payload.experiment_id);
    if (!experiment.ok) {
      return experiment;
    }
    const exp = experiment.data;
    if (exp.stage !== "finished") {
      return reject("NOT_FINISHED", "envelope.record requires stage=finished");
    }
    if (typeof exp.actuals.ca_hours !== "number") {
      return reject("MISSING_ACTUALS", "finished experiment needs numeric actuals.ca_hours");
    }
    const baseline = {
      experiment_id: exp.experiment_id,
      title: exp.title,
      instrument: payload.instrument || exp.instrument || "apl prove",
      actuals_ca_hours: exp.actuals.ca_hours,
      actuals_proof_min: exp.actuals.proof_min,
      runner_result: payload.runner_result || null,
      packet_uri: payload.packet_uri || store.experimentPath(exp.experiment_id),
      finished_at: exp.actuals.finished_at,
    };
    const uri = store.saveBaseline(baseline);
    persistAttention();
    return ok({ baseline, uri });
  }

  function planFanout(payload) {
    const experiment = loadRequiredExperiment(payload.experiment_id);
    if (!experiment.ok) {
      return experiment;
    }
    const probes = Array.isArray(payload.probes) ? payload.probes : [];
    const n = payload.n != null ? payload.n : probes.length;
    const constraint = payload.constraint || null;
    if (!Number.isInteger(n) || n < 1) {
      return reject("SINGLE_LANE", "fan-out n must be a positive integer");
    }
    if (n < 2 && !constraint) {
      return reject("SINGLE_LANE", "n<2 with no physics/human constraint");
    }
    for (const probe of probes) {
      if (probe.kind !== "fetch" && probe.kind !== "run") {
        return reject("PROBE_NOT_FETCH_OR_RUN", `${probe.id || "probe"} kind must be fetch|run`);
      }
    }
    if (probes.length && probes.length !== n) {
      return reject("SINGLE_LANE", `n=${n} but probes.length=${probes.length}`);
    }

    const exp = experiment.data;
    exp.fanout = {
      n,
      probes: probes.map(normalizeProbe),
      recombine: "evidence_only",
      anti_single_lane: n >= 2 || constraint ? "pass" : "fail",
      constraint,
    };
    exp.stage = "fanout";
    store.saveExperiment(exp);
    persistAttention();
    return ok({ experiment: exp });
  }

  function planAccept(payload) {
    const experiment = loadRequiredExperiment(payload.experiment_id);
    if (!experiment.ok) {
      return experiment;
    }
    const exp = experiment.data;
    const machine = requireMachineTime(exp);
    if (!machine.ok) {
      return machine;
    }

    const shrink = detectShrink(exp, payload, payload.constraint || (exp.fanout && exp.fanout.constraint) || null);
    if (shrink) {
      return shrink;
    }

    let fanout = payload.fanout || exp.fanout;
    if (payload.probes && !fanout) {
      fanout = {
        n: payload.n || payload.probes.length,
        probes: payload.probes,
        constraint: payload.constraint || null,
        recombine: payload.recombine || "evidence_only",
      };
    }
    if (payload.n && !fanout) {
      fanout = {
        n: payload.n,
        probes: payload.probes || [],
        constraint: payload.constraint || null,
        recombine: payload.recombine || "evidence_only",
      };
    }
    if (!fanout) {
      return reject("SINGLE_LANE", "plan.accept needs fan-out");
    }
    const n = fanout.n != null ? fanout.n : (fanout.probes || []).length;
    const constraint = fanout.constraint || payload.constraint || null;
    if (n < 2 && !constraint) {
      return reject("SINGLE_LANE", "unconstrained single-lane ACCEPT");
    }

    const envelopeAck = payload.envelope_query_id || payload.envelope === "NO_BASELINE" || payload.no_baseline === true;
    if (!envelopeAck && !exp.envelope_query_id) {
      return reject("NO_ENVELOPE_QUERY", "plan.accept requires envelope.query id or NO_BASELINE ack");
    }
    if (payload.envelope_query_id && !store.hasEnvelopeQuery(payload.envelope_query_id) && payload.envelope !== "NO_BASELINE") {
      return reject("NO_ENVELOPE_QUERY", `unknown envelope query id ${payload.envelope_query_id}`);
    }

    const probes = fanout.probes || [];
    for (const probe of probes) {
      if (probe.kind !== "fetch" && probe.kind !== "run") {
        return reject("PROBE_NOT_FETCH_OR_RUN", `${probe.id || "probe"} is not fetch|run`);
      }
    }

    const evidence = [];
    for (const probe of probes) {
      const status = probe.status;
      if (status !== "fetched" && status !== "ran") {
        return reject("NO_EVIDENCE_RECOMBINE", `${probe.id || "probe"} has not fetched or run`);
      }
      if (!probe.evidence_uri) {
        return reject("NO_EVIDENCE_RECOMBINE", `${probe.id || "probe"} missing evidence_uri`);
      }
      evidence.push(probe.evidence_uri);
    }
    if (payload.recombine && payload.recombine !== "evidence_only") {
      return reject("NO_EVIDENCE_RECOMBINE", "recombine must be evidence_only");
    }
    if (!evidence.length) {
      return reject("NO_EVIDENCE_RECOMBINE", "no evidence URIs to recombine");
    }

    exp.fanout = {
      n,
      probes: probes.map(normalizeProbe),
      recombine: "evidence_only",
      anti_single_lane: "pass",
      constraint,
    };
    exp.envelope_query_id = payload.envelope_query_id || exp.envelope_query_id || "NO_BASELINE";
    exp.stage = "accepted";
    store.saveExperiment(exp);
    persistAttention();
    return ok({
      experiment: exp,
      evidence_uri: evidence,
    });
  }

  function claimSubmit(payload) {
    if (payload.verdict != null) {
      return reject("SELF_CERT", "authoring agent may not set verdict");
    }

    const weightBody = claimLooksWeightOnly(payload);
    const packet = resolvePacket(payload);

    if (weightBody && !packet) {
      return reject("WEIGHT_ONLY", "claim is only confidence/Δ/LGTM with no instrument packet");
    }
    if (!packet) {
      return reject("NO_RESEARCH", "claim.submit needs a Proof Layer packet or fetch/run evidence_uri");
    }
    if (packetLooksMarkdown(packet, payload)) {
      return reject("NO_RESEARCH", "markdown/skill/chat is not an instrument packet");
    }
    if (weightBody && !hasRunnerResult(packet)) {
      return reject("WEIGHT_ONLY", "weight may sit beside evidence, not replace it");
    }
    if (!hasRunnerResult(packet)) {
      return reject("NO_RESEARCH", "packet missing runner_result VERIFIED|REJECTED|INCONCLUSIVE");
    }
    if (packet.verdict != null) {
      return reject("SELF_CERT", "packet.verdict must stay null until Eng Proof");
    }

    const claim = {
      experiment_id: payload.experiment_id || packet.experiment_id || null,
      runner_result: packet.runner_result,
      verdict: null,
      packet_uri: payload.packet_uri || payload.evidence_uri || null,
      submitted_at: new Date().toISOString(),
    };
    const id = claim.experiment_id || `claim-${Date.now()}`;
    const uri = store.savePacket(id, { ...packet, claim });
    return ok({ claim, packet_uri: uri });
  }

  function claimVerdictDraft(payload) {
    if (payload.verdict != null) {
      return reject("SELF_CERT", "Eng Proof owns verdict; agent may only draft runner_result");
    }
    return ok({
      draft: true,
      runner_result: payload.runner_result || null,
      verdict: null,
    });
  }

  function attentionDump() {
    const dump = persistAttention();
    return ok({
      dump,
      dump_uri: "board/attention.dump.json",
      hard_law: HARD_LAW,
    });
  }

  function steerGate(payload, actor) {
    if (actor !== "human") {
      return reject("NOT_HUMAN", "steer.gate is human only");
    }
    const experiment = loadRequiredExperiment(payload.experiment_id);
    if (!experiment.ok) {
      return experiment;
    }
    const exp = experiment.data;
    if (payload.resolve) {
      exp.human_gates = (exp.human_gates || []).map((gate) => {
        if (gate.kind === payload.kind || gate.kind === payload.resolve) {
          return { ...gate, resolved: true, resolved_reason: payload.reason || "resolved" };
        }
        return gate;
      });
    } else {
      if (!payload.kind || !GATE_KINDS.has(payload.kind)) {
        return reject("MISSING_MACHINE_TIME", "steer.gate needs a legal human gate kind");
      }
      exp.human_gates = exp.human_gates || [];
      exp.human_gates.push(normalizeGate({ kind: payload.kind, reason: payload.reason || "human steer" }));
    }
    store.saveExperiment(exp);
    persistAttention();
    return ok({ experiment: exp });
  }

  function persistAttention() {
    const dump = buildAttentionDump(store);
    store.saveAttention(dump);
    return dump;
  }

  function loadRequiredExperiment(id) {
    if (!id) {
      return reject("MISSING_MACHINE_TIME", "experiment_id is required");
    }
    const exp = store.loadExperiment(id);
    if (!exp) {
      return reject("MISSING_MACHINE_TIME", `experiment not on local board: ${id}`);
    }
    return ok(exp);
  }

  return {
    store,
    dispatch,
    persistAttention,
  };
}

function requireMachineTime(payload) {
  const missing = [];
  if (typeof payload.estimate_ca_hours !== "number" || !Number.isFinite(payload.estimate_ca_hours)) {
    missing.push("estimate_ca_hours");
  }
  if (typeof payload.estimate_proof_min !== "number" || !Number.isFinite(payload.estimate_proof_min)) {
    missing.push("estimate_proof_min");
  }
  if (!Array.isArray(payload.human_gates)) {
    missing.push("human_gates");
  }
  if (!payload.actuals || typeof payload.actuals !== "object" || Array.isArray(payload.actuals)) {
    missing.push("actuals");
  } else {
    for (const key of ["ca_hours", "proof_min", "human_hours", "finished_at"]) {
      if (!(key in payload.actuals)) {
        missing.push(`actuals.${key}`);
      }
    }
  }
  if (missing.length) {
    return reject("MISSING_MACHINE_TIME", `missing ${missing.join(", ")}`);
  }
  return { ok: true };
}

function normalizeGate(gate) {
  const kind = gate && gate.kind;
  if (!GATE_KINDS.has(kind)) {
    throw new Error(`unhandled HumanGateKind: ${kind}`);
  }
  return {
    kind,
    reason: gate.reason || "",
    estimate_human_hours: gate.estimate_human_hours,
    resolved: Boolean(gate.resolved),
  };
}

function normalizeProbe(probe) {
  return {
    id: probe.id,
    kind: probe.kind,
    command_or_url: probe.command_or_url,
    evidence_uri: probe.evidence_uri || null,
    status: probe.status || "pending",
  };
}

function rejectWeekWithoutGate(payload) {
  const gates = Array.isArray(payload.human_gates) ? payload.human_gates : [];
  const hits = [];
  walk(payload, (key, value, trail) => {
    if (BANNED_TIME_KEYS.has(key)) {
      hits.push(trail ? `${trail}.${key}` : key);
      return;
    }
    if (trail.includes("human_gates") && key === "estimate_human_hours") {
      return;
    }
    if (typeof value === "string" && WEEK_TOKEN.test(value)) {
      hits.push(trail ? `${trail}.${key}` : key);
    }
  });
  if (hits.length && gates.length === 0) {
    return reject("HUMAN_WEEK_WITHOUT_GATE", `week/sprint unit without a human gate: ${hits.join(", ")}`);
  }
  if (hits.some((hit) => BANNED_TIME_KEYS.has(hit.split(".").pop()))) {
    return reject("HUMAN_WEEK_WITHOUT_GATE", `banned week key stored: ${hits.join(", ")}`);
  }
  return null;
}

function walk(value, visit, trail = "") {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, trail);
    if (child && typeof child === "object") {
      walk(child, visit, trail ? `${trail}.${key}` : key);
    }
  }
}

function detectShrink(opened, later, constraint) {
  if (constraint) {
    return null;
  }
  const openedN = opened.opened_n || (opened.fanout && opened.fanout.n) || null;
  const laterN = later.n || later.opened_n || (later.fanout && later.fanout.n) || null;
  if (openedN && laterN && laterN < openedN) {
    return reject("UNDER_SCOPE", `probe count ${openedN} → ${laterN} without physics/human constraint`);
  }
  const openedKill = opened.kill || "";
  const laterKill = later.kill || "";
  if (openedKill && laterKill && laterKill !== openedKill && /positive\s*Δ|positive delta/i.test(laterKill)) {
    return reject("UNDER_SCOPE", "kill softened without physics/human constraint");
  }
  const openedInst = opened.instrument || "";
  const laterInst = later.instrument || "";
  if (openedInst && laterInst && README_INSTRUMENT.test(laterInst) && !README_INSTRUMENT.test(openedInst)) {
    return reject("UNDER_SCOPE", "instrument swapped for README/skill theater");
  }
  if (
    typeof opened.estimate_ca_hours === "number" &&
    typeof later.estimate_ca_hours === "number" &&
    later.estimate_ca_hours < opened.estimate_ca_hours &&
    later.kill &&
    opened.kill &&
    later.kill === opened.kill
  ) {
    return reject("UNDER_SCOPE", "estimate_ca_hours cut with the same kill and no constraint");
  }
  return null;
}

function claimLooksWeightOnly(payload) {
  const parts = [payload.body, payload.claim, payload.text, payload.verdict_text, payload.summary]
    .filter((part) => typeof part === "string")
    .join(" ");
  if (payload.confidence != null || payload.delta != null || payload.stars != null || payload.weight != null) {
    return true;
  }
  return Boolean(parts) && WEIGHT_ONLY_TOKEN.test(parts);
}

function resolvePacket(payload) {
  if (payload.packet && typeof payload.packet === "object") {
    return payload.packet;
  }
  if (payload.runner_result && payload.measured_exit != null) {
    return payload;
  }
  return null;
}

function packetLooksMarkdown(packet, payload) {
  const uri = String(payload.packet_uri || payload.evidence_uri || packet.packet_uri || "");
  if (/\.(md|markdown)$/i.test(uri) || /skill\.md/i.test(uri)) {
    return true;
  }
  if (packet.kind === "markdown" || packet.type === "skill") {
    return true;
  }
  return false;
}

function hasRunnerResult(packet) {
  const result = packet.runner_result || (packet.result && packet.result.observed && packet.result.observed.runner_result);
  return result === "VERIFIED" || result === "REJECTED" || result === "INCONCLUSIVE";
}

module.exports = {
  TOOLS,
  createKernel,
  requireMachineTime,
  reject,
  assertNeverReject,
};
