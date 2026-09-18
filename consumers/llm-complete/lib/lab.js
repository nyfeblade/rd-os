"use strict";

const fs = require("fs");
const path = require("path");

const CONSUMER_ROOT = path.resolve(__dirname, "..");
const RELATIVE_ADAPTER = "../../src/providers";
const RELATIVE_MCP_RECIPE = "../cursor-mcp/.cursor/mcp.json";

function resolveLab() {
  if (process.env.RDOS_LAB) {
    return path.resolve(process.env.RDOS_LAB);
  }
  const checkout = path.resolve(CONSUMER_ROOT, "../..");
  if (fs.existsSync(path.join(checkout, "src", "providers", "index.js"))) {
    return checkout;
  }
  throw new Error("rd-os lab not found. Run from consumers/llm-complete inside an rd-os checkout.");
}

function assertLab(lab) {
  const pkgPath = path.join(lab, "package.json");
  const adapterPath = path.join(lab, "src", "providers", "index.js");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`lab package.json missing at ${lab}`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "rd-os") {
    throw new Error(`resolved package is not rd-os (${pkg.name})`);
  }
  if (!fs.existsSync(adapterPath)) {
    throw new Error(`lab missing src/providers/index.js at ${adapterPath}`);
  }
  const labAbs = fs.realpathSync(lab);
  const consumerAbs = fs.realpathSync(CONSUMER_ROOT);
  if (labAbs === consumerAbs) {
    throw new Error("refusing to treat consumers/llm-complete as the lab; require ../../src/providers");
  }
  return {
    lab: labAbs,
    adapterJs: adapterPath,
    mcpJs: path.join(lab, "bin", "mcp.js"),
  };
}

function loadProviders(labInfo) {
  return require(labInfo.adapterJs);
}

function readRecipe() {
  const recipePath = path.join(CONSUMER_ROOT, ".cursor", "recipe.json");
  if (!fs.existsSync(recipePath)) {
    throw new Error("missing consumers/llm-complete/.cursor/recipe.json");
  }
  const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
  if (!recipe || recipe.provider !== "openai") {
    throw new Error(".cursor/recipe.json must name shipped provider openai");
  }
  if (recipe.adapter !== RELATIVE_ADAPTER) {
    throw new Error(`.cursor/recipe.json adapter must be ${RELATIVE_ADAPTER}`);
  }
  if (!recipe.mcp || recipe.mcp.see !== RELATIVE_MCP_RECIPE) {
    throw new Error(`.cursor/recipe.json must point MCP attach at ${RELATIVE_MCP_RECIPE}`);
  }
  if (!/STOP/i.test(recipe.resource_exhausted || "")) {
    throw new Error(".cursor/recipe.json must document ResourceExhausted STOP");
  }
  return { recipePath, recipe };
}

function relativeAttachConfig() {
  return {
    llmComplete: {
      command: "node",
      args: ["./bin/complete.js", "--in", "payloads/hello.json"],
      env: {
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "${OPENAI_API_KEY}",
      },
    },
    mcpServers: {
      note: "Do not replace. Keep consumers/cursor-mcp/.cursor/mcp.json as the rd-os MCP attach.",
      see: RELATIVE_MCP_RECIPE,
    },
  };
}

module.exports = {
  CONSUMER_ROOT,
  RELATIVE_ADAPTER,
  RELATIVE_MCP_RECIPE,
  resolveLab,
  assertLab,
  loadProviders,
  readRecipe,
  relativeAttachConfig,
};
