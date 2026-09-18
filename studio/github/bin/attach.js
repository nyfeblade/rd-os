#!/usr/bin/env node
"use strict";

const { loadRecipe } = require("../lib/connectors");

const result = loadRecipe("github");
if (!result.ok) {
  process.stderr.write(`${JSON.stringify(result)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
