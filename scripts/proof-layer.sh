#!/usr/bin/env bash
# First instrument hook: clone/call agent-proof-layer `npm run demo:reject`.
# Does not fork Proof Layer. Does not set verdict.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

node -e '
const fs = require("fs");
const path = require("path");
const { createKernel } = require("./src/kernel");
const { runProofLayerReject, loadPacketIfPresent } = require("./src/proof-layer");

const home = process.env.RDOS_HOME || path.join(process.cwd(), "var", "proof-layer");
const hooked = runProofLayerReject();
const packet = loadPacketIfPresent(hooked);
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
  verdict: null,
  ok: hooked.ok,
  detail: hooked.detail || null,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
process.stdout.write(`${hooked.stdout || ""}\n`);
if (!hooked.ok) {
  process.exit(1);
}
'
