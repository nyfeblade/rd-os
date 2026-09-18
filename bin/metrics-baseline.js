#!/usr/bin/env node
"use strict";

const path = require("path");
const { writeBaseline } = require("../src/metrics/harness");

function parseArgs(argv) {
  const args = argv.slice(2);
  let home = null;
  let out = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--home") {
      home = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--out") {
      out = args[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${args[i]}`);
  }
  return { home, out };
}

function main() {
  const parsed = parseArgs(process.argv);
  const result = writeBaseline({
    home: parsed.home,
    out: parsed.out || path.join(process.cwd(), "var", "metrics", "baseline.json"),
  });
  if (!result.ok) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, out: result.out, baseline: result.baseline }, null, 2)}\n`);
}

main();
