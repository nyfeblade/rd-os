#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  CONSUMER_ROOT,
  resolveLab,
  assertLab,
  relativeAttachConfig,
  absoluteAttachConfig,
} = require("../lib/lab");

function fail(message) {
  process.stderr.write(`FAIL cursor-mcp attach: ${message}\n`);
  process.exit(1);
}

function main() {
  const writeAbsolute = process.argv.includes("--write-absolute");
  let labInfo;
  try {
    labInfo = assertLab(resolveLab());
  } catch (err) {
    fail(err.message || String(err));
  }

  const relative = relativeAttachConfig();
  const home = path.join(labInfo.lab, "var");
  const absolute = absoluteAttachConfig(labInfo.lab, home);
  const configPath = path.join(CONSUMER_ROOT, ".cursor", "mcp.json");

  process.stdout.write(`cursor-mcp: lab ${labInfo.lab}\n`);
  process.stdout.write(`cursor-mcp: stdio ${labInfo.mcpJs}\n`);
  process.stdout.write(`cursor-mcp: committed ${configPath}\n`);
  process.stdout.write("\n# Relative (open consumers/cursor-mcp as the Cursor project)\n");
  process.stdout.write(`${JSON.stringify(relative, null, 2)}\n`);
  process.stdout.write("\n# Absolute (Cursor Settings → MCP, or any cwd)\n");
  process.stdout.write(`${JSON.stringify(absolute, null, 2)}\n`);

  if (writeAbsolute) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(absolute, null, 2)}\n`);
    process.stdout.write(`\nwrote absolute attach config to ${configPath}\n`);
  }

  process.stdout.write(
    "\nEquivalent shell: RDOS_HOME=<lab>/var RDOS_ACTOR=agent node <lab>/bin/mcp.js\n"
  );
}

main();
