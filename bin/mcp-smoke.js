#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const path = require("path");
const { TOOLS } = require("../src/kernel");
const { createFrameParser, encodeFramed } = require("../src/mcp-server");

function fail(message) {
  process.stderr.write(`FAIL mcp-smoke: ${message}\n`);
  process.exit(1);
}

function main() {
  const home = process.env.RDOS_HOME || path.join(process.cwd(), "var", "mcp-smoke");
  const child = spawn(process.execPath, [path.join(__dirname, "mcp.js")], {
    env: { ...process.env, RDOS_HOME: home, RDOS_ACTOR: "agent" },
    stdio: ["pipe", "pipe", "inherit"],
  });

  let nextId = 1;
  const pending = new Map();
  const parser = createFrameParser((message) => {
    if (message && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  child.stdout.on("data", (chunk) => parser.push(chunk));

  function call(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 8000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(encodeFramed({ jsonrpc: "2.0", id, method, params }));
    });
  }

  Promise.resolve()
    .then(async () => {
      const init = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "rd-os-smoke" } });
      if (!init.result || init.result.serverInfo.name !== "rd-os") {
        fail("initialize missing rd-os serverInfo");
      }
      const listed = await call("tools/list", {});
      const names = (listed.result.tools || []).map((tool) => tool.name).sort();
      const expected = TOOLS.slice().sort();
      if (names.join(" ") !== expected.join(" ")) {
        fail(`tools/list mismatch: ${names.join(",")} vs ${expected.join(",")}`);
      }
      const dump = await call("tools/call", { name: "attention.dump", arguments: {} });
      const dumpBody = JSON.parse(dump.result.content[0].text);
      if (!dumpBody.ok || !dumpBody.data.dump.p0 || dumpBody.data.dump.hard_law.length < 5) {
        fail("attention.dump via MCP missing p0/hard_law");
      }
      const steer = await call("tools/call", {
        name: "steer.gate",
        arguments: { experiment_id: "missing", kind: "merge", reason: "agent must be rejected" },
      });
      const steerBody = JSON.parse(steer.result.content[0].text);
      if (steerBody.ok || steerBody.code !== "NOT_HUMAN") {
        fail("steer.gate from MCP agent must be NOT_HUMAN");
      }
      process.stdout.write("PASS mcp-smoke (initialize + tools/list + attention.dump + steer.gate NOT_HUMAN)\n");
      child.kill("SIGTERM");
      process.exit(0);
    })
    .catch((err) => {
      child.kill("SIGTERM");
      fail(err.message || String(err));
    });
}

main();
