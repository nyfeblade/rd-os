#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { buildDemoDump } = require("../lib/studio");

function main(argv) {
  const dump = buildDemoDump();
  const json = `${JSON.stringify(dump, null, 2)}\n`;
  const outFlag = argv.indexOf("--out");
  if (outFlag >= 0 && argv[outFlag + 1]) {
    const dest = path.resolve(argv[outFlag + 1]);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, json, "utf8");
  } else {
    process.stdout.write(json);
  }
}

main(process.argv.slice(2));
