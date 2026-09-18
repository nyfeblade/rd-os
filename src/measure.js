"use strict";

const { createKernel, requireMachineTime } = require("./kernel");

const REQUIRED_FIELDS = ["estimate_ca_hours", "estimate_proof_min", "human_gates", "actuals"];

function fieldCompleteness(packet) {
  const present = REQUIRED_FIELDS.filter((field) => packet[field] !== undefined);
  return {
    present_n: present.length,
    required_n: REQUIRED_FIELDS.length,
    ratio: present.length / REQUIRED_FIELDS.length,
    present,
  };
}

function measureWedge(home) {
  const incomplete = {
    experiment_id: "measure-incomplete",
    title: "incomplete packet",
    estimate_ca_hours: 1,
    // missing estimate_proof_min, human_gates, actuals
  };
  const complete = {
    experiment_id: "measure-complete",
    title: "complete packet",
    estimate_ca_hours: 1,
    estimate_proof_min: 5,
    human_gates: [{ kind: "merge", reason: "playbook: human-owned merges" }],
    actuals: { ca_hours: null, proof_min: null, human_hours: null, finished_at: null },
  };

  const markdownStart = process.hrtime.bigint();
  const markdownStore = [incomplete, complete];
  const markdownComplete = markdownStore.filter((row) => requireMachineTime(row).ok).length;
  const markdownIncompleteKept = markdownStore.filter((row) => !requireMachineTime(row).ok).length;
  // Markdown path: write anything. Incomplete packets stay on the "board".
  const markdownFalsifyMs = Number(process.hrtime.bigint() - markdownStart) / 1e6;
  const markdownPacketCompleteness = markdownComplete / markdownStore.length;

  const kernel = createKernel(home);
  const rdosStart = process.hrtime.bigint();
  const rejected = kernel.dispatch("experiment.open", incomplete);
  const rdosFalsifyMs = Number(process.hrtime.bigint() - rdosStart) / 1e6;
  const accepted = kernel.dispatch("experiment.open", complete);
  const stored = kernel.store.listExperiments();
  const storedComplete = stored.filter((row) => requireMachineTime(row).ok).length;
  const rdosPacketCompleteness = stored.length ? storedComplete / stored.length : 0;

  const beatsCompleteness = rdosPacketCompleteness > markdownPacketCompleteness;
  const beatsFalsify =
    rejected.ok === false &&
    rejected.code === "MISSING_MACHINE_TIME" &&
    Number.isFinite(rdosFalsifyMs) &&
    markdownIncompleteKept > 0;

  const winner = beatsCompleteness && beatsFalsify ? "rdos" : "INCONCLUSIVE";

  return {
    metric: "packet_completeness_and_time_to_falsify_setup",
    markdown: {
      packet_completeness: markdownPacketCompleteness,
      incomplete_kept: markdownIncompleteKept,
      time_to_falsify_ms: null,
      note: "docs/example path keeps incomplete packets; no reject",
      completeness_probe_ms: markdownFalsifyMs,
    },
    rdos: {
      packet_completeness: rdosPacketCompleteness,
      incomplete_rejected: rejected.ok === false,
      reject_code: rejected.code || null,
      time_to_falsify_ms: rdosFalsifyMs,
      complete_open_ok: accepted.ok === true,
      stored_n: stored.length,
    },
    beats_markdown: winner === "rdos",
    verdict: winner === "rdos" ? "KEEP_WEDGE" : "INCONCLUSIVE",
    next_measurement:
      winner === "rdos"
        ? "Eng Proof runs ./scripts/kill14d.sh --arm markdown --day 0 and --arm rdos --day 7; do not start 14d clock from this CA"
        : "stop expand; re-measure packet completeness (stored complete / stored n) and reject latency on incomplete experiment.open",
  };
}

module.exports = {
  measureWedge,
  fieldCompleteness,
};
