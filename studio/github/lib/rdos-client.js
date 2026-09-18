"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { reject, ok } = require("./errors");

function defaultLabRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

function createRdosClient(options) {
  const labRoot = options && options.labRoot ? options.labRoot : defaultLabRoot();
  const spawn = options && options.spawnSync ? options.spawnSync : spawnSync;

  function cliPath() {
    return path.join(labRoot, "bin", "rdos.js");
  }

  function dumpAttention() {
    const cli = cliPath();
    if (!fs.existsSync(cli)) {
      return reject("NO_KERNEL", "public rdos CLI not found; studio does not own the kernel");
    }
    const home = path.join(os.tmpdir(), "rdos-studio-github");
    fs.mkdirSync(home, { recursive: true });
    const out = path.join(home, "attention.json");
    const started = Date.now();
    const result = spawn(process.execPath, [cli, "attention.dump", "--home", home, "--out", out], {
      encoding: "utf8",
    });
    const wallMs = Date.now() - started;
    if (result.status !== 0) {
      return reject("NO_KERNEL", (result.stderr || result.stdout || "rdos attention.dump failed").trim(), {
        wall_ms: wallMs,
      });
    }
    if (!fs.existsSync(out)) {
      return reject("NO_KERNEL", "rdos wrote no attention dump", { wall_ms: wallMs });
    }
    return ok({
      attention: JSON.parse(fs.readFileSync(out, "utf8")),
      via: "bin/rdos.js",
      wall_ms: wallMs,
    });
  }

  return {
    labRoot,
    cliPath,
    dumpAttention,
  };
}

module.exports = {
  defaultLabRoot,
  createRdosClient,
};
