#!/usr/bin/env node
"use strict";

const path = require("path");
const { createLabServer } = require("../src/lab-server");

function parseArgs(argv) {
  const args = argv.slice(2);
  let home = process.env.RDOS_HOME || path.join(process.cwd(), "var");
  let port = Number(process.env.PORT || 7420);
  let host = process.env.HOST || "127.0.0.1";
  let seed = true;
  let fixture = process.env.RDOS_FIXTURE || null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--home") {
      home = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--port") {
      port = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (args[i] === "--host") {
      host = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--no-seed") {
      seed = false;
      continue;
    }
    if (args[i] === "--fixture") {
      fixture = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "-h" || args[i] === "--help") {
      process.stdout.write("Usage: lab [--port 7420] [--home var] [--no-seed] [--fixture needs-you]\n");
      process.exit(0);
    }
    throw new Error(`unknown argument: ${args[i]}`);
  }
  return { home, port, host, seed, fixture };
}

const parsed = parseArgs(process.argv);
const { server } = createLabServer({
  home: parsed.home,
  root: path.resolve(__dirname, ".."),
  seed: parsed.seed,
  fixture: parsed.fixture,
});

server.listen(parsed.port, parsed.host, () => {
  const url = `http://${parsed.host}:${parsed.port}`;
  process.stdout.write(`rd-os lab ${url}\n`);
  process.stdout.write(`MCP attach (stdio): node bin/mcp.js   # RDOS_HOME=${parsed.home}\n`);
  process.stdout.write("Waiting home. attention.dump is SoT. Human steer: rdos steer.gate --actor human.\n");
});
