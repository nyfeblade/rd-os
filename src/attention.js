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

function buildAttentionDump(store, nowMs = Date.now()) {
  const experiments = store.listExperiments();
  const open = experiments.filter((exp) => exp.stage !== "finished" && exp.stage !== "killed");
  const p0Source = open[0] || null;
  let waitingOn = "agent";
  let why = "no open experiment";
  let ageS = 0;
  let p0Id = null;

  if (p0Source) {
    p0Id = p0Source.experiment_id;
    const hasMergeGate = (p0Source.human_gates || []).some((gate) => gate.kind === "merge");
    if (p0Source.stage === "accepted" && hasMergeGate) {
      waitingOn = "human";
      why = "accepted plan waiting on human merge gate";
    } else if (p0Source.stage === "open" || p0Source.stage === "fanout") {
      waitingOn = "agent";
      why = `${p0Source.stage} packet needs fan-out / claim instrument`;
    } else {
      waitingOn = "proof";
      why = "packet present; Eng Proof owns verdict";
    }
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
  };

  return dump;
}

module.exports = {
  HARD_LAW,
  buildAttentionDump,
  describeWaitingOn,
};
