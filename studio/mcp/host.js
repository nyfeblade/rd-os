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

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { isProviderId } = require("./lib/providers");
const { SERVER_INFO } = require("./lib/codes");
const { encodeFramed, createFrameParser } = require("./server");

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

/**
 * Synchronous readiness check for a one-click Connect: is this attach even
 * launchable? Never spawns. Returns { ok, provider, binPath, reasons }.
 */
function preflight(options) {
  const opts = options || {};
  const reasons = [];
  if (!isProviderId(opts.provider)) {
    reasons.push(`unknown provider: ${String(opts.provider)}`);
  }
  const binPath = serverBinPath();
  if (!fs.existsSync(binPath)) {
    reasons.push(`server bin missing: ${binPath}`);
  }
  if (opts.home != null && opts.home !== "") {
    const home = String(opts.home);
    if (fs.existsSync(home) && !fs.statSync(home).isDirectory()) {
      reasons.push(`home is not a directory: ${home}`);
    }
  }
  return {
    ok: reasons.length === 0,
    provider: isProviderId(opts.provider) ? opts.provider : null,
    binPath,
    reasons,
  };
}

/**
 * Self-test the generated attach config end-to-end: spawn the stdio server,
 * `initialize`, confirm the provider seat comes online + in-studio-only, then
 * shut it down. This is what a one-click Connect calls to prove the wiring
 * works — not a persistent host (the agent's own MCP client owns the seat).
 *
 * Resolves { ok:true, provider, online, seat } or { ok:false, code, detail }.
 * Never rejects.
 */
function probe(options) {
  const opts = options || {};
  const timeoutMs = typeof opts.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : 8000;

  return new Promise((resolve) => {
    let entry;
    try {
      entry = attachEntry(opts);
    } catch (err) {
      resolve({ ok: false, code: err && err.code ? err.code : "BAD_OPTIONS", detail: err && err.message ? err.message : String(err) });
      return;
    }

    const command = entry.command === "node" ? process.execPath : entry.command;
    let child;
    try {
      child = spawn(command, entry.args, {
        env: Object.assign({}, process.env, entry.env),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ ok: false, code: "SPAWN_FAILED", detail: err && err.message ? err.message : String(err) });
      return;
    }

    let settled = false;
    let stderr = "";
    let nextId = 1;
    const pending = new Map();

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        child.stdin.end();
      } catch (_end) {
        // ignore
      }
      try {
        child.kill("SIGTERM");
      } catch (_kill) {
        // ignore
      }
      resolve(result);
    }

    const timer = setTimeout(() => {
      finish({ ok: false, code: "PROBE_TIMEOUT", detail: `no online seat within ${timeoutMs}ms${stderr ? ` stderr=${stderr.trim()}` : ""}` });
    }, timeoutMs);

    const parser = createFrameParser((message) => {
      if (message && pending.has(message.id)) {
        const handler = pending.get(message.id);
        pending.delete(message.id);
        handler(message);
      }
    });

    child.on("error", (err) => {
      finish({ ok: false, code: "SPAWN_FAILED", detail: err && err.message ? err.message : String(err) });
    });
    child.stdout.on("data", (chunk) => parser.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    function call(method, params) {
      const id = nextId;
      nextId += 1;
      child.stdin.write(encodeFramed({ jsonrpc: "2.0", id, method, params }));
      return new Promise((okCall) => {
        pending.set(id, okCall);
      });
    }

    Promise.resolve()
      .then(async () => {
        const init = await call("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "studio-mcp-probe" },
        });
        if (!init.result || !init.result.serverInfo || init.result.serverInfo.name !== SERVER_INFO.name) {
          finish({ ok: false, code: "INIT_FAILED", detail: `serverInfo ${JSON.stringify(init.result && init.result.serverInfo)}` });
          return;
        }
        const seats = await call("tools/call", { name: "studio.seats.list", arguments: {} });
        const body = JSON.parse(seats.result.content[0].text);
        if (!body.ok) {
          finish({ ok: false, code: "SEATS_FAILED", detail: `${body.code} ${body.detail || ""}`.trim() });
          return;
        }
        const seat = body.data.seats.find((row) => row.id === opts.provider);
        if (!seat || seat.presence !== "online" || seat.in_studio_only !== true) {
          finish({ ok: false, code: "SEAT_NOT_ONLINE", detail: JSON.stringify(seat || null) });
          return;
        }
        finish({ ok: true, provider: opts.provider, online: true, seat });
      })
      .catch((err) => {
        finish({ ok: false, code: "PROBE_ERROR", detail: err && err.message ? err.message : String(err) });
      });
  });
}

module.exports = {
  SERVER_BIN,
  DEFAULT_KEY,
  serverBinPath,
  attachEntry,
  attachConfig,
  attachConfigJson,
  preflight,
  probe,
};
