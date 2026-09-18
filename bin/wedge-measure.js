#!/usr/bin/env node
"use strict";

const path = require("path");
const { measureWedge } = require("../src/measure");

const home = process.argv.includes("--home")
  ? process.argv[process.argv.indexOf("--home") + 1]
  : path.join(process.cwd(), "var", "wedge-measure");

const report = measureWedge(home);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.beats_markdown ? 0 : 2);
