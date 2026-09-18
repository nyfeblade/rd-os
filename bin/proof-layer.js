#!/usr/bin/env node
"use strict";

const path = require("path");
const { createKernel } = require("../src/kernel");
const { runProofLayerReject, loadPacketIfPresent, copyEvidence } = require("../src/proof-layer");

const root = path.resolve(__dirname, "..");
const home = process.env.RDOS_HOME || path.join(root, "var", "proof-layer");
const hooked = runProofLayerReject({ repoRoot: root });
const packet = loadPacketIfPresent(hooked);
const evidence = copyEvidence(hooked, { repoRoot: root, home });
if (packet) {
  const kernel = createKernel(home);
  kernel.dispatch("claim.submit", {
    experiment_id: packet.experiment_id || "exp-1-planted-false",
    packet,
    packet_uri: hooked.packet_path,
  });
}
const out = {
  runner_result: hooked.runner_result,
  commit: hooked.commit,
  packet: hooked.packet_path,
  wall_ms: hooked.wall_ms,
  measured_exit: hooked.measured_exit,
  expect_exit: hooked.expect_exit,
  command: hooked.command,
  evidence,
  verdict: null,
  ok: hooked.ok,
  detail: hooked.detail || null,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
if (hooked.stdout) {
  process.stdout.write(`${hooked.stdout}\n`);
}
process.exit(hooked.ok ? 0 : 1);
