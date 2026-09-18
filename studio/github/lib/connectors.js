"use strict";

const fs = require("fs");
const path = require("path");
const { assertNeverConnector, reject } = require("./errors");

const CONNECTOR_IDS = ["github", "grok", "claude", "cursor"];
const RECIPE_DIR = path.join(__dirname, "..", "recipes");

function isConnectorId(id) {
  return CONNECTOR_IDS.includes(id);
}

function describeKnown(id) {
  switch (id) {
    case "github":
      return {
        id: "github",
        kind: "repo",
        status: "ready",
        label: "GitHub",
        summary: "Repo browse + attach. First coding connector.",
        surface: "eng",
      };
    case "grok":
      return {
        id: "grok",
        kind: "seat",
        status: "stub",
        label: "Grok",
        summary: "Coding connector stub. Later wire via studio/seats.",
        surface: "eng",
      };
    case "claude":
      return {
        id: "claude",
        kind: "seat",
        status: "stub",
        label: "Claude",
        summary: "Coding connector stub. Later wire via studio/seats.",
        surface: "eng",
      };
    case "cursor":
      return {
        id: "cursor",
        kind: "seat",
        status: "stub",
        label: "Cursor",
        summary: "Coding connector stub. MCP attach stays consumers/cursor-mcp.",
        surface: "eng",
      };
    default:
      return assertNeverConnector(id);
  }
}

function listConnectors() {
  return CONNECTOR_IDS.map(describeKnown);
}

function loadRecipe(id) {
  if (!isConnectorId(id)) {
    return reject("UNKNOWN_CONNECTOR", `unknown connector ${id}`);
  }
  const file = path.join(RECIPE_DIR, `${id}.json`);
  const recipe = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ok: true, data: recipe, stop: false };
}

function surfaceHooks() {
  return {
    job: "human+AI coding",
    surface: "eng",
    theater: false,
    hooks: [
      {
        id: "file-tree",
        event: "studio:open-file",
        status: "ready",
        selector: "[data-hook='file-tree']",
      },
      {
        id: "pr-list",
        event: "studio:open-pr",
        status: "ready",
        selector: "[data-hook='pr-list']",
      },
      {
        id: "coding-surface",
        event: "studio:edit",
        status: "stub",
        selector: "[data-hook='coding-surface']",
      },
      {
        id: "connector-attach",
        event: "studio:attach",
        status: "ready",
        selector: "[data-hook='connector-attach']",
      },
      {
        id: "seat-grok",
        event: "studio:seat",
        status: "stub",
        connector: "grok",
      },
      {
        id: "seat-claude",
        event: "studio:seat",
        status: "stub",
        connector: "claude",
      },
      {
        id: "seat-cursor",
        event: "studio:seat",
        status: "stub",
        connector: "cursor",
      },
    ],
  };
}

module.exports = {
  CONNECTOR_IDS,
  isConnectorId,
  describeKnown,
  listConnectors,
  loadRecipe,
  surfaceHooks,
};
