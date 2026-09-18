"use strict";

/**
 * In-app host helper for the Studio MCP server.
 *
 * The stdio server (`server/bin.js`) is how a coding agent attaches into Studio.
 * The friction is discovery: a stranger has to hand-write the `mcpServers` JSON
 * and, worst of all, the ABSOLUTE path to `server/bin.js`. This module removes
 * the path paste — Studio resolves the path itself and emits a copy-paste-ready
 * attach config for a chosen provider seat.
 *
 * Pure Node, zero dependencies (this package must stay install-free).
 * It does not start a process or occupy a seat — `initialize` over stdio is
 * still what connects (see CONNECTION.md). This only produces the client config.
 */

const path = require("path");
const { isProviderId } = require("./lib/providers");
const { SERVER_INFO } = require("./lib/codes");

const SERVER_BIN = path.join(__dirname, "server", "bin.js");
const DEFAULT_KEY = SERVER_INFO.name;

function serverBinPath() {
  return SERVER_BIN;
}

function unknownProvider(provider) {
  const err = new Error(`unknown Studio MCP provider: ${String(provider)}`);
  err.code = "UNKNOWN_PROVIDER";
  return err;
}

function buildEnv(options) {
  const env = { STUDIO_PROVIDER: options.provider };
  if (options.home != null && options.home !== "") {
    env.STUDIO_HOME = String(options.home);
  }
  if (options.repo != null && options.repo !== "") {
    env.STUDIO_REPO = String(options.repo);
  }
  return env;
}

/**
 * The inner `mcpServers[<key>]` value: how the client spawns this seat.
 * `command` defaults to "node"; pass an absolute node path for full robustness.
 */
function attachEntry(options) {
  const opts = options || {};
  if (!isProviderId(opts.provider)) {
    throw unknownProvider(opts.provider);
  }
  return {
    command: opts.command ? String(opts.command) : "node",
    args: [serverBinPath()],
    env: buildEnv(opts),
  };
}

/**
 * Full client config object: `{ mcpServers: { "ai-coding-studio": { ... } } }`.
 * `key` overrides the server label (defaults to the server name).
 */
function attachConfig(options) {
  const opts = options || {};
  const key = opts.key ? String(opts.key) : DEFAULT_KEY;
  return { mcpServers: { [key]: attachEntry(opts) } };
}

/** Pretty JSON a stranger can paste straight into their MCP client settings. */
function attachConfigJson(options) {
  return `${JSON.stringify(attachConfig(options), null, 2)}\n`;
}

module.exports = {
  SERVER_BIN,
  DEFAULT_KEY,
  serverBinPath,
  attachEntry,
  attachConfig,
  attachConfigJson,
};
