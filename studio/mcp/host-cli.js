#!/usr/bin/env node
"use strict";

/**
 * Terminal front-end for the Studio MCP host helpers — the "one-click" flow
 * from a shell. Prints copy-paste attach config, runs a preflight, or self-tests
 * a connection with `probe`. Pure Node, zero dependencies.
 *
 *   node studio/mcp/host-cli.js config   --provider cursor [--home DIR] [--repo DIR]
 *   node studio/mcp/host-cli.js preflight --provider cursor [--home DIR]
 *   node studio/mcp/host-cli.js probe     --provider cursor [--home DIR] [--repo DIR]
 */

const { attachConfigJson, preflight, probe } = require("./host");

const USAGE = [
  "Usage: studio-mcp-host <command> --provider <id> [--home DIR] [--repo DIR]",
  "",
  "Commands:",
  "  config      print copy-paste MCP client config (mcpServers JSON)",
  "  preflight   sync readiness check (JSON: ok, provider, binPath, reasons)",
  "  probe       spawn the server, verify an online seat, shut down (JSON)",
  "  help        show this help",
  "",
  "Providers: claude | grok | cursor | codex | gemini | chatgpt",
].join("\n");

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || "help";
  const opts = {};
  for (let i = 1; i < args.length; i += 1) {
    const flag = args[i];
    const value = args[i + 1];
    switch (flag) {
      case "--provider":
        opts.provider = value;
        i += 1;
        break;
      case "--home":
        opts.home = value;
        i += 1;
        break;
      case "--repo":
        opts.repo = value;
        i += 1;
        break;
      default:
        opts.error = `unknown flag: ${flag}`;
    }
  }
  return { command, opts };
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const { command, opts } = parseArgs(process.argv);
  if (opts.error) {
    process.stderr.write(`${opts.error}\n${USAGE}\n`);
    process.exit(2);
    return;
  }

  switch (command) {
    case "help":
    case "-h":
    case "--help":
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
      return;
    case "config":
      try {
        process.stdout.write(attachConfigJson(opts));
        process.exit(0);
      } catch (err) {
        process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
        process.exit(2);
      }
      return;
    case "preflight": {
      const result = preflight(opts);
      writeJson(result);
      process.exit(result.ok ? 0 : 1);
      return;
    }
    case "probe": {
      const result = await probe(opts);
      writeJson(result);
      process.exit(result.ok ? 0 : 1);
      return;
    }
    default:
      process.stderr.write(`unknown command: ${command}\n${USAGE}\n`);
      process.exit(2);
  }
}

main();
