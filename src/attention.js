"use strict";

const HARD_LAW = [
  "machine-time",
  "multi-lane",
  "research-before-claim",
  "envelope",
  "attention-beside-law",
];

function assertNeverWaitingOn(who) {
  throw new Error(`unhandled WaitingOn: ${who}`);
}

function describeWaitingOn(who) {
  switch (who) {
    case "human":
      return "human gate";
    case "agent":
      return "agent work";
    case "proof":
      return "Eng Proof";
    default:
      return assertNeverWaitingOn(who);
  }
}

function classifyWaiting(exp) {
  const hasOpenMerge = (exp.human_gates || []).some((gate) => gate.kind === "merge" && !gate.resolved);
  if (exp.stage === "accepted" && hasOpenMerge) {
    return { waitingOn: "human", why: "accepted plan waiting on human merge gate" };
  }
  if (exp.stage === "open" || exp.stage === "fanout") {
    return { waitingOn: "agent", why: `${exp.stage} packet needs fan-out / claim instrument` };
  }
  return { waitingOn: "proof", why: "packet present; Eng Proof owns verdict" };
}

function pickP0(open) {
  const rank = { human: 0, proof: 1, agent: 2 };
  return open.slice().sort((left, right) => {
    const leftRank = rank[classifyWaiting(left).waitingOn];
    const rightRank = rank[classifyWaiting(right).waitingOn];
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftOpened = left.opened_at ? Date.parse(left.opened_at) : 0;
    const rightOpened = right.opened_at ? Date.parse(right.opened_at) : 0;
    return leftOpened - rightOpened;
  })[0] || null;
}

function buildAttentionDump(store, nowMs = Date.now()) {
  const experiments = store.listExperiments();
  const open = experiments.filter((exp) => exp.stage !== "finished" && exp.stage !== "killed");
  const p0Source = pickP0(open);
  let waitingOn = "agent";
  let why = "no open experiment";
  let ageS = 0;
  let p0Id = null;

  if (p0Source) {
    const classified = classifyWaiting(p0Source);
    p0Id = p0Source.experiment_id;
    waitingOn = classified.waitingOn;
    why = classified.why;
    if (p0Source.opened_at) {
      ageS = Math.max(0, Math.floor((nowMs - Date.parse(p0Source.opened_at)) / 1000));
    }
  }

  const openGates = [];
  for (const exp of open) {
    for (const gate of exp.human_gates || []) {
      if (gate.resolved) {
        continue;
      }
      openGates.push(`${exp.experiment_id}:${gate.kind}`);
    }
  }

  const baselines = store.listBaselines();
  const nearest = baselines[baselines.length - 1] || null;

  const dump = {
    p0: p0Source
      ? {
          id: p0Id,
          why,
          waiting_on: waitingOn,
          age_s: ageS,
        }
      : {
          id: "idle",
          why: "board empty — open an experiment packet",
          waiting_on: "agent",
          age_s: 0,
        },
    hard_law: HARD_LAW.slice(),
    open_gates: openGates,
    envelope_hint: {
      nearest_experiment_id: nearest ? nearest.experiment_id : null,
      baseline_ca_hours: nearest && typeof nearest.actuals_ca_hours === "number" ? nearest.actuals_ca_hours : null,
    },
    thesis: p0Source
      ? {
          id: p0Source.experiment_id,
          title: p0Source.title,
          kill: p0Source.kill || null,
          instrument: p0Source.instrument || null,
          stage: p0Source.stage,
        }
      : null,
    bottleneck: {
      waiting_on: waitingOn,
      why,
      age_s: ageS,
    },
    redirect: {
      open_gates: openGates,
      steer: "steer.gate --actor human",
      note: "Human adds/resolves gates. Agents calling steer.gate get NOT_HUMAN.",
    },
  };

  return dump;
}

module.exports = {
  HARD_LAW,
  buildAttentionDump,
  classifyWaiting,
  describeWaitingOn,
};
