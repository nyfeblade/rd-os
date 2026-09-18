#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { createKernel, TOOLS } = require("../src/kernel");

function printUsage(stream) {
  stream.write("Usage: rdos <tool> [--in payload.json] [--out result.json] [--home dir] [--actor agent|human]\n");
  stream.write(`Tools: ${TOOLS.join(" ")}\n`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    return { mode: "help" };
  }
  const tool = args[0];
  let inPath = null;
  let outPath = null;
  let home = null;
  let actor = "agent";
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--in") {
      inPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out") {
      outPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--home") {
      home = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--actor") {
      actor = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { mode: "error", message: `unknown flag: ${arg}` };
    }
    return { mode: "error", message: `unexpected argument: ${arg}` };
  }
  return { mode: "run", tool, inPath, outPath, home, actor };
}

function loadPayload(inPath) {
  if (!inPath) {
    return {};
  }
  const abs = path.resolve(process.cwd(), inPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`--in file not found: ${inPath}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function main() {
  const parsed = parseArgs(process.argv);
  switch (parsed.mode) {
    case "help":
      printUsage(process.stdout);
      process.exit(0);
      break;
    case "error":
      process.stderr.write(`${parsed.message}\n`);
      printUsage(process.stderr);
      process.exit(2);
      break;
    case "run": {
      const kernel = createKernel(parsed.home);
      const payload = loadPayload(parsed.inPath);
      const result = kernel.dispatch(parsed.tool, payload, { actor: parsed.actor });
      const text = `${JSON.stringify(result, null, 2)}\n`;
      if (parsed.outPath) {
        const abs = path.resolve(process.cwd(), parsed.outPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
      process.stdout.write(text);
      process.exit(result.ok ? 0 : 1);
      break;
    }
    default: {
      const _exhaustive = parsed.mode;
      throw new Error(`unhandled CLI mode: ${_exhaustive}`);
    }
  }
}

main();
