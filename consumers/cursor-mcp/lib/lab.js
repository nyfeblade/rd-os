"use strict";

const fs = require("fs");
const path = require("path");

const CONSUMER_ROOT = path.resolve(__dirname, "..");
const RELATIVE_MCP_JS = "../../bin/mcp.js";
const RELATIVE_RDOS_HOME = "../../var";

function resolveLab() {
  if (process.env.RDOS_LAB) {
    return path.resolve(process.env.RDOS_LAB);
  }
  try {
    return fs.realpathSync(path.dirname(require.resolve("rd-os/package.json")));
  } catch (_err) {
    const checkout = path.resolve(CONSUMER_ROOT, "../..");
    if (fs.existsSync(path.join(checkout, "bin", "mcp.js"))) {
      return checkout;
    }
    throw new Error("rd-os lab not found. From consumers/cursor-mcp run: npm install");
  }
}

function assertLab(lab) {
  const pkgPath = path.join(lab, "package.json");
  const mcpPath = path.join(lab, "bin", "mcp.js");
  const contractPath = path.join(lab, "MCP_CONTRACT.md");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`lab package.json missing at ${lab}`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "rd-os") {
    throw new Error(`resolved package is not rd-os (${pkg.name})`);
  }
  if (!fs.existsSync(mcpPath)) {
    throw new Error(`installed lab missing bin/mcp.js at ${mcpPath}`);
  }
  if (!fs.existsSync(contractPath)) {
    throw new Error(`installed lab missing MCP_CONTRACT.md at ${contractPath}`);
  }
  const labAbs = fs.realpathSync(lab);
  const consumerAbs = fs.realpathSync(CONSUMER_ROOT);
  if (labAbs === consumerAbs) {
    throw new Error("refusing to treat consumers/cursor-mcp as the lab; attach ../../bin/mcp.js");
  }
  return {
    lab: labAbs,
    mcpJs: mcpPath,
    contractPath,
    rdosJs: path.join(lab, "bin", "rdos.js"),
  };
}

function extractContractTools(contractText) {
  const tools = [];
  const seen = new Set();
  for (const line of contractText.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)`\s*\|/);
    if (!match) {
      continue;
    }
    const name = match[1];
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    tools.push(name);
  }
  if (!tools.length) {
    throw new Error("MCP_CONTRACT.md Tool surface table has no `tool.name` rows");
  }
  if (!/\bWEIGHT_ONLY\b/.test(contractText)) {
    throw new Error("MCP_CONTRACT.md missing WEIGHT_ONLY reject code");
  }
  return tools;
}

function relativeAttachConfig() {
  return {
    mcpServers: {
      "rd-os": {
        command: "node",
        args: [RELATIVE_MCP_JS],
        env: {
          RDOS_HOME: RELATIVE_RDOS_HOME,
          RDOS_ACTOR: "agent",
        },
      },
    },
  };
}

function absoluteAttachConfig(lab, home) {
  return {
    mcpServers: {
      "rd-os": {
        command: "node",
        args: [path.join(lab, "bin", "mcp.js")],
        env: {
          RDOS_HOME: home,
          RDOS_ACTOR: "agent",
        },
      },
    },
  };
}

function readCommittedAttachConfig() {
  const configPath = path.join(CONSUMER_ROOT, ".cursor", "mcp.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("missing consumers/cursor-mcp/.cursor/mcp.json");
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const server = config && config.mcpServers && config.mcpServers["rd-os"];
  if (!server || !Array.isArray(server.args) || server.args[0] !== RELATIVE_MCP_JS) {
    throw new Error(`.cursor/mcp.json must attach ${RELATIVE_MCP_JS}`);
  }
  if (!server.env || server.env.RDOS_HOME !== RELATIVE_RDOS_HOME) {
    throw new Error(`.cursor/mcp.json must set RDOS_HOME to ${RELATIVE_RDOS_HOME}`);
  }
  return { configPath, config };
}

module.exports = {
  CONSUMER_ROOT,
  RELATIVE_MCP_JS,
  RELATIVE_RDOS_HOME,
  resolveLab,
  assertLab,
  extractContractTools,
  relativeAttachConfig,
  absoluteAttachConfig,
  readCommittedAttachConfig,
};
