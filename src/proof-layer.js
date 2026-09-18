"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const APL_REPO = "https://github.com/nyfeblade/agent-proof-layer.git";
const DEFAULT_CACHE = "/tmp/rd-os-agent-proof-layer";

function resolveAplDir() {
  if (process.env.APL_DIR) {
    return path.resolve(process.env.APL_DIR);
  }
  return DEFAULT_CACHE;
}

function runProofLayerReject(options = {}) {
  const aplDir = options.aplDir || resolveAplDir();
  const started = Date.now();
  const clone = ensureClone(aplDir);
  if (!clone.ok) {
    return {
      ok: false,
      runner_result: "INCONCLUSIVE",
      detail: clone.detail,
      wall_ms: Date.now() - started,
      commit: null,
      packet_path: null,
      stdout: clone.stdout || "",
      stderr: clone.stderr || "",
    };
  }

  const ran = spawnSync("npm", ["run", "demo:reject"], {
    cwd: aplDir,
    encoding: "utf8",
    env: process.env,
  });
  const stdout = ran.stdout || "";
  const stderr = ran.stderr || "";
  const firstLine = stdout.trim().split("\n")[0] || "";
  const commit = matchField(stdout, /^commit:\s+(\S+)/m);
  const packetPath = matchField(stdout, /^packet:\s+(\S+)/m);
  const wallField = matchField(stdout, /^wall_ms:\s+(\S+)/m);
  const measuredExit = matchField(stdout, /measured_exit:\s+(\S+)/);
  const runnerResult = firstLine === "REJECTED" || firstLine === "VERIFIED" || firstLine === "INCONCLUSIVE"
    ? firstLine
    : "INCONCLUSIVE";

  return {
    ok: runnerResult === "REJECTED" && ran.status === 0,
    runner_result: runnerResult,
    commit,
    packet_path: packetPath,
    packet_abs: packetPath ? path.join(aplDir, packetPath) : null,
    wall_ms: wallField ? Number(wallField) : Date.now() - started,
    measured_exit: measuredExit == null ? null : Number(measuredExit),
    expect_exit: 0,
    stdout,
    stderr,
    exit: ran.status,
    apl_dir: aplDir,
  };
}

function ensureClone(aplDir) {
  if (fs.existsSync(path.join(aplDir, "package.json")) && fs.existsSync(path.join(aplDir, "bin", "apl.js"))) {
    return { ok: true };
  }
  fs.mkdirSync(path.dirname(aplDir), { recursive: true });
  if (fs.existsSync(aplDir)) {
    fs.rmSync(aplDir, { recursive: true, force: true });
  }
  const cloned = spawnSync("git", ["clone", "--depth", "1", APL_REPO, aplDir], {
    encoding: "utf8",
  });
  if (cloned.status !== 0) {
    return {
      ok: false,
      detail: `git clone agent-proof-layer failed: ${cloned.stderr || cloned.stdout}`,
      stdout: cloned.stdout,
      stderr: cloned.stderr,
    };
  }
  return { ok: true };
}

function matchField(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : null;
}

function loadPacketIfPresent(result) {
  if (!result.packet_abs || !fs.existsSync(result.packet_abs)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(result.packet_abs, "utf8"));
}

module.exports = {
  APL_REPO,
  runProofLayerReject,
  loadPacketIfPresent,
  resolveAplDir,
};
