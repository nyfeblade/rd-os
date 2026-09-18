"use strict";

const fs = require("fs");
const path = require("path");
const { resolveHome } = require("../store");
const { measureWedge } = require("../measure");
const { exerciseControlPlane } = require("./exercise");

const COLD_REPRO = {
  script: "bin/metrics-baseline.js",
  commands: [
    "node bin/metrics-baseline.js --out var/metrics/baseline.json",
  ],
};

function baselinePath(homeArg, outArg) {
  if (outArg) {
    return path.resolve(outArg);
  }
  return path.join(resolveHome(homeArg), "metrics", "baseline.json");
}

function writeBaseline(options = {}) {
  const home = resolveHome(options.home);
  const measureHome = options.measureHome || path.join(home, "metrics-measure");
  const planeHome = options.planeHome || path.join(home, "metrics-plane");
  const measured = measureWedge(measureHome);
  const exercised = exerciseControlPlane(planeHome);
  if (!exercised.ok) {
    return { ok: false, code: exercised.code, detail: exercised.detail, out: null, baseline: null };
  }
  const baseline = {
    generated_at: new Date().toISOString(),
    packet_completeness: {
      markdown: measured.markdown.packet_completeness,
      rdos: measured.rdos.packet_completeness,
    },
    time_to_falsify_ms: {
      markdown: measured.markdown.time_to_falsify_ms,
      rdos: measured.rdos.time_to_falsify_ms,
      note: "proxy: wall time of experiment.open reject on an incomplete packet",
    },
    cold_repro: COLD_REPRO,
    clock_started: false,
    kill14d_verdict: null,
    control_plane: exercised.data,
    wedge_measure: {
      beats_markdown: measured.beats_markdown,
      incomplete_rejected: measured.rdos.incomplete_rejected,
      reject_code: measured.rdos.reject_code,
    },
  };
  const out = baselinePath(home, options.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`);
  return { ok: true, baseline, out };
}

module.exports = {
  COLD_REPRO,
  baselinePath,
  writeBaseline,
};
