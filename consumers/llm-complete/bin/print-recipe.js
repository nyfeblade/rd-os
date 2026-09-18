#!/usr/bin/env node
"use strict";

const path = require("path");
const { CONSUMER_ROOT, readRecipe, relativeAttachConfig, resolveLab, assertLab } = require("../lib/lab");

function main() {
  const { recipePath, recipe } = readRecipe();
  const labInfo = assertLab(resolveLab());
  const attach = relativeAttachConfig();

  process.stdout.write(`llm-complete: lab ${labInfo.lab}\n`);
  process.stdout.write(`llm-complete: adapter ${labInfo.adapterJs}\n`);
  process.stdout.write(`llm-complete: recipe ${recipePath}\n`);
  process.stdout.write(`llm-complete: shipped provider ${recipe.provider}\n`);
  process.stdout.write("\n# Cursor attach — llm.complete beside existing MCP (do not replace MCP)\n");
  process.stdout.write(`${JSON.stringify(attach, null, 2)}\n`);
  process.stdout.write("\n# Equivalent shell\n");
  process.stdout.write(
    "OPENAI_API_KEY=… LLM_PROVIDER=openai node consumers/llm-complete/bin/complete.js --in payloads/hello.json\n"
  );
  process.stdout.write("\n# Keep MCP attach from consumers/cursor-mcp/.cursor/mcp.json\n");
  process.stdout.write(`see ${path.join(CONSUMER_ROOT, recipe.mcp.see)}\n`);
}

main();
