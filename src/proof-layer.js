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

function repoRootFrom(options = {}) {
  if (options.repoRoot) {
    return path.resolve(options.repoRoot);
  }
  return path.resolve(__dirname, "..");
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
      command: "npm run demo:reject",
      apl_dir: aplDir,
    };
  }

  const ran = spawnSync("npm", ["run", "demo:reject"], {
    cwd: aplDir,
    encoding: "utf8",
    env: process.env,
  });
  const stdout = ran.stdout || "";
  const stderr = ran.stderr || "";
  const resultLine =
    stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line === "REJECTED" || line === "VERIFIED" || line === "INCONCLUSIVE") || "INCONCLUSIVE";
  const commit = matchField(stdout, /^commit:\s+(\S+)/m);
  const packetPath = matchField(stdout, /^packet:\s+(\S+)/m);
  const wallField = matchField(stdout, /^wall_ms:\s+(\S+)/m);
  const measuredExit = matchField(stdout, /measured_exit:\s+(\S+)/);

  return {
    ok: resultLine === "REJECTED" && ran.status === 0,
    runner_result: resultLine,
    commit,
    packet_path: packetPath,
    packet_abs: packetPath ? path.join(aplDir, packetPath) : null,
    wall_ms: wallField ? Number(wallField) : Date.now() - started,
    measured_exit: measuredExit == null || measuredExit === "null" ? null : Number(measuredExit),
    expect_exit: 0,
    stdout,
    stderr,
    exit: ran.status,
    apl_dir: aplDir,
    command: "npm run demo:reject",
    detail: resultLine === "REJECTED" ? null : `demo:reject produced ${resultLine} exit=${ran.status}`,
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

function copyEvidence(result, options = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dirs = [];
  const repoEvidence = path.join(repoRootFrom(options), "evidence", "proof-layer", stamp);
  dirs.push(repoEvidence);
  if (options.home) {
    dirs.push(path.join(options.home, "evidence", "proof-layer", stamp));
  }
  const packet = loadPacketIfPresent(result);
  const written = [];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "stdout.txt"), result.stdout || "");
    fs.writeFileSync(
      path.join(dir, "hook.json"),
      `${JSON.stringify(
        {
          runner_result: result.runner_result,
          measured_exit: result.measured_exit,
          expect_exit: result.expect_exit,
          wall_ms: result.wall_ms,
          commit: result.commit,
          command: result.command,
          verdict: null,
          ok: result.ok,
        },
        null,
        2
      )}\n`
    );
    if (packet) {
      fs.writeFileSync(path.join(dir, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`);
    }
    written.push(dir);
  }
  return { dirs: written, packet_copied: Boolean(packet) };
}

module.exports = {
  APL_REPO,
  runProofLayerReject,
  loadPacketIfPresent,
  resolveAplDir,
  copyEvidence,
};
