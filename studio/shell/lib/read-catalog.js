"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Read-only SoT. This lane never writes `studio/connectors/**`. */
const CATALOG_REL = "studio/connectors/CATALOG.md";

function catalogPath() {
  return path.resolve(__dirname, "..", "..", "connectors", "CATALOG.md");
}

function catalogPresent() {
  return fs.existsSync(catalogPath());
}

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

function slugFromName(name) {
  const key = String(name).toLowerCase();
  if (key.includes("github")) {
    return "github";
  }
  if (key.includes("cursor") || key.includes("cloud agent")) {
    return "cursor";
  }
  if (key.includes("claude")) {
    return "claude";
  }
  if (key.includes("grok") || key.includes("xai") || key.includes("x.ai")) {
    return "grok";
  }
  if (key.includes("linear")) {
    return "linear";
  }
  if (key.includes("sentry")) {
    return "sentry";
  }
  if (key.includes("vercel")) {
    return "vercel";
  }
  return key
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function trayLabel(name) {
  return String(name)
    .replace(/ MCP$/i, "")
    .split(" / ")[0]
    .trim();
}

function parsePrioritySection(markdown, priority) {
  switch (priority) {
    case "P0":
    case "P1":
    case "P2":
      break;
    default:
      return assertNever(priority);
  }
  const start = markdown.indexOf(`\n## ${priority}`);
  if (start < 0) {
    return [];
  }
  const rest = markdown.slice(start + 1);
  const next = rest.search(/\n## P[012]\b/);
  const section = next < 0 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 3) {
      continue;
    }
    if (cells[0] === "Name" || /^[-:\s]+$/.test(cells[0])) {
      continue;
    }
    if (cells[1] !== priority) {
      continue;
    }
    rows.push({
      id: slugFromName(cells[0]),
      label: trayLabel(cells[0]),
      catalogName: cells[0],
      type: cells[2],
      priority,
      status: "needs-auth",
    });
  }
  return rows;
}

function parseP0(markdown) {
  const rows = parsePrioritySection(markdown, "P0");
  if (!rows.length) {
    throw new Error("CATALOG.md has no P0 rows");
  }
  return rows;
}

function readCatalogMarkdown() {
  return fs.readFileSync(catalogPath(), "utf8");
}

function readCatalogP0() {
  return parseP0(readCatalogMarkdown());
}

/** Consume CATALOG.md when present. Empty when the connectors lane has not landed. */
function tryReadCatalogP0() {
  if (!catalogPresent()) {
    return [];
  }
  return readCatalogP0();
}

module.exports = {
  CATALOG_REL,
  catalogPath,
  catalogPresent,
  parseP0,
  parsePrioritySection,
  readCatalogMarkdown,
  readCatalogP0,
  tryReadCatalogP0,
  slugFromName,
  trayLabel,
};
