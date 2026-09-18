#!/usr/bin/env node
"use strict";

const path = require("path");
const { runKill14d } = require("../src/kill14d");

function parseArgs(argv) {
  const args = argv.slice(2);
  let arm = null;
  let day = null;
  let home = null;
  let skipM1 = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--arm") {
      arm = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--day") {
      day = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--home") {
      home = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--skip-m1") {
      skipM1 = true;
      continue;
    }
    throw new Error(`unknown argument: ${args[i]}`);
  }
  if (!arm || day == null) {
    throw new Error("Usage: kill14d --arm markdown|rdos --day 0|7|14 [--home dir] [--skip-m1]");
  }
  return { arm, day, home, skipM1 };
}

const parsed = parseArgs(process.argv);
const report = runKill14d({
  arm: parsed.arm,
  day: parsed.day,
  home: parsed.home || path.join(process.cwd(), "var", `kill14d-${parsed.arm}-day${parsed.day}`),
  skipM1: parsed.skipM1,
});
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
