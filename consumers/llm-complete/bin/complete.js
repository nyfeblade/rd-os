#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { assertLab, loadProviders, resolveLab } = require("../lib/lab");

function printUsage(stream) {
  stream.write("Usage: complete [--in payload.json] [--out result.json] [--prompt text]\n");
  stream.write("Env: OPENAI_API_KEY (required for live), LLM_PROVIDER=openai, OPENAI_MODEL, OPENAI_BASE_URL\n");
  stream.write("ResourceExhausted ⇒ STOP, no retry.\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    return { mode: "help" };
  }
  let inPath = null;
  let outPath = null;
  let prompt = null;
  for (let i = 0; i < args.length; i += 1) {
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
    if (arg === "--prompt") {
      prompt = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { mode: "error", message: `unknown flag: ${arg}` };
    }
    return { mode: "error", message: `unexpected argument: ${arg}` };
  }
  return { mode: "run", inPath, outPath, prompt };
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

async function main() {
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
      const labInfo = assertLab(resolveLab());
      const { complete } = loadProviders(labInfo);
      const payload = loadPayload(parsed.inPath);
      if (parsed.prompt) {
        payload.prompt = parsed.prompt;
      }
      const result = await complete(payload);
      const text = `${JSON.stringify(result, null, 2)}\n`;
      if (parsed.outPath) {
        fs.writeFileSync(path.resolve(process.cwd(), parsed.outPath), text);
      } else {
        process.stdout.write(text);
      }
      if (!result.ok && result.code === "RESOURCE_EXHAUSTED") {
        process.stderr.write("llm.complete: RESOURCE_EXHAUSTED — STOP, no retry\n");
        process.exit(3);
      }
      process.exit(result.ok ? 0 : 1);
      break;
    }
    default: {
      const _exhaustive = parsed.mode;
      throw new Error(`unhandled parse mode: ${_exhaustive}`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message || String(err)}\n`);
  process.exit(1);
});
