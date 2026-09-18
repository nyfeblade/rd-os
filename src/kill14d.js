"use strict";

const fs = require("fs");
const path = require("path");
const { createKernel } = require("./kernel");
const { runProofLayerReject, loadPacketIfPresent, copyEvidence } = require("./proof-layer");

const REQUIRED_KEYS = [
  "m1_rejected",
  "m1_n",
  "m2_illegal_accepts",
  "m3_weight_only_rejected",
  "m3_n",
  "m4_underscope_rejected",
  "m4_n",
  "m5_compliant",
  "m5_n",
  "m6_baselines",
  "m6_accepts_without_query",
  "m7_p0_present",
  "m7_hard_law_n",
];

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function loadPlants() {
  const dir = path.join(repoRoot(), "fixtures", "kill-14d");
  return {
    m2: readJson(path.join(dir, "m2-single-lane.json")),
    m3: readJson(path.join(dir, "m3-weight-only.json")),
    m4: readJson(path.join(dir, "m4-underscope.json")),
    m5: readJson(path.join(dir, "m5-machine-time.json")),
  };
}

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function emptyCounts() {
  return {
    m1_rejected: 0,
    m1_n: 3,
    m2_illegal_accepts: 0,
    m3_weight_only_rejected: 0,
    m3_n: 5,
    m4_underscope_rejected: 0,
    m4_n: 5,
    m5_compliant: 0,
    m5_n: 0,
    m6_baselines: 0,
    m6_accepts_without_query: 0,
    m7_p0_present: false,
    m7_hard_law_n: 0,
  };
}

function runMarkdownArm() {
  const plants = loadPlants();
  const counts = emptyCounts();
  counts.m1_rejected = 0;
  counts.m2_illegal_accepts = plants.m2.length;
  counts.m3_weight_only_rejected = 0;
  counts.m3_n = plants.m3.length;
  counts.m4_underscope_rejected = 0;
  counts.m4_n = plants.m4.length;
  counts.m5_n = plants.m5.length;
  counts.m5_compliant = plants.m5.filter((row) => row.expect === "ok").length;
  counts.m6_baselines = 0;
  counts.m6_accepts_without_query = 1;
  counts.m7_p0_present = false;
  counts.m7_hard_law_n = 0;
  counts.arm_note = "markdown baseline: no MCP reject; plants self-cert as prose";
  return counts;
}

function runRdosArm(home, options = {}) {
  const plants = loadPlants();
  const kernel = createKernel(home);
  const counts = emptyCounts();

  counts.m1_n = 3;
  if (options.skipM1) {
    counts.m1_note = "M1 skipped this invocation; run scripts/proof-layer.sh for live demo:reject";
  } else {
    for (let i = 0; i < 3; i += 1) {
      const hooked = runProofLayerReject(options.proofLayer || {});
      if (hooked.ok && hooked.runner_result === "REJECTED") {
        counts.m1_rejected += 1;
        const packet = loadPacketIfPresent(hooked) || {
          experiment_id: `m1-planted-false-${i}`,
          runner_result: "REJECTED",
          verdict: null,
          measured_exit: hooked.measured_exit,
          wall_ms: hooked.wall_ms,
        };
        kernel.dispatch("claim.submit", {
          experiment_id: `m1-planted-false-${i}`,
          packet,
        });
        copyEvidence(hooked, { home, repoRoot: repoRoot() });
      }
      counts.m1_last = {
        runner_result: hooked.runner_result,
        measured_exit: hooked.measured_exit,
        wall_ms: hooked.wall_ms,
        commit: hooked.commit,
        detail: hooked.detail || null,
      };
    }
  }

  for (const plant of plants.m2) {
    const opened = kernel.dispatch("experiment.open", plant.open);
    if (!opened.ok) {
      continue;
    }
    const accepted = kernel.dispatch("plan.accept", plant.accept);
    if (accepted.ok) {
      counts.m2_illegal_accepts += 1;
    }
  }

  counts.m3_n = plants.m3.length;
  for (const plant of plants.m3) {
    const result = kernel.dispatch("claim.submit", plant);
    if (!result.ok && result.code === "WEIGHT_ONLY") {
      counts.m3_weight_only_rejected += 1;
    }
  }

  counts.m4_n = plants.m4.length;
  for (const plant of plants.m4) {
    const opened = kernel.dispatch("experiment.open", plant.open);
    if (!opened.ok) {
      continue;
    }
    const accepted = kernel.dispatch("plan.accept", plant.accept);
    if (!accepted.ok && accepted.code === "UNDER_SCOPE") {
      counts.m4_underscope_rejected += 1;
    }
  }

  counts.m5_n = plants.m5.length;
  for (const plant of plants.m5) {
    const result = kernel.dispatch("experiment.open", plant.open);
    const compliant = plant.expect === "ok" ? result.ok : !result.ok && result.code === plant.expect;
    if (compliant) {
      counts.m5_compliant += 1;
    }
  }

  const m6Open = kernel.dispatch("experiment.open", {
    experiment_id: "m6-no-query",
    title: "accept without envelope query",
    estimate_ca_hours: 1,
    estimate_proof_min: 5,
    human_gates: [{ kind: "merge", reason: "playbook: human-owned merges" }],
    actuals: { ca_hours: null, proof_min: null, human_hours: null, finished_at: null },
  });
  if (m6Open.ok) {
    const noQuery = kernel.dispatch("plan.accept", {
      experiment_id: "m6-no-query",
      n: 2,
      probes: [
        { id: "p0", kind: "run", command_or_url: "true", status: "ran", evidence_uri: "board/packets/p0.json" },
        { id: "p1", kind: "fetch", command_or_url: "https://example.com", status: "fetched", evidence_uri: "board/packets/p1.json" },
      ],
    });
    if (noQuery.ok) {
      counts.m6_accepts_without_query += 1;
    } else {
      counts.m6_no_query_code = noQuery.code;
    }
  }
  const query = kernel.dispatch("envelope.query", { similar: "exp-2-wedge" });
  counts.m6_baselines = kernel.store.listBaselines().length;
  if (query.ok) {
    counts.m6_query_id = query.data.query_id;
    counts.m6_code = query.data.code || null;
  }

  const dump = kernel.dispatch("attention.dump", {});
  if (dump.ok && dump.data.dump && dump.data.dump.p0 && Array.isArray(dump.data.dump.hard_law)) {
    counts.m7_p0_present = true;
    counts.m7_hard_law_n = dump.data.dump.hard_law.length;
  }

  counts.arm_note = "rdos treatment: MCP/kernel must-reject; not a 14d PASS";
  return counts;
}

function runKill14d({ arm, day, home, skipM1 }) {
  if (arm !== "markdown" && arm !== "rdos") {
    throw new Error(`unknown arm: ${arm}`);
  }
  if (![0, 7, 14].includes(Number(day))) {
    throw new Error(`day must be 0, 7, or 14 (got ${day})`);
  }

  const counts = arm === "markdown" ? runMarkdownArm() : runRdosArm(home, { skipM1 });
  const report = {
    arm,
    day: Number(day),
    clock_started: false,
    verdict: null,
    note: "day 0 armable now; 14d clock not started; Eng Proof owns verdict; harness ≠ day-14 PASS",
    ...counts,
  };
  for (const key of REQUIRED_KEYS) {
    if (!(key in report)) {
      throw new Error(`kill14d missing required key ${key}`);
    }
  }
  return report;
}

module.exports = {
  REQUIRED_KEYS,
  runKill14d,
};
