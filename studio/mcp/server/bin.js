#!/usr/bin/env node
"use strict";

const { createStudioMcpServer, attachStdio } = require("./index");
const { isProviderId } = require("../lib/providers");
const { unknownProvider } = require("../lib/session");

const provider = process.env.STUDIO_PROVIDER;

if (!isProviderId(provider)) {
  process.stderr.write(`${JSON.stringify(unknownProvider(provider))}\n`);
  process.exit(2);
}

const server = createStudioMcpServer({
  provider,
  home: process.env.STUDIO_HOME || null,
  repo: process.env.STUDIO_REPO || process.cwd(),
  chatHome: process.env.CHAT_ENGINE_HOME || null,
});

let exiting = false;
function shutdown(code) {
  if (exiting) {
    return;
  }
  exiting = true;
  server.disconnect();
  process.exit(typeof code === "number" ? code : 0);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.stdin.on("end", () => shutdown(0));
process.stdin.on("close", () => shutdown(0));

attachStdio(server, process.stdin, process.stdout);
process.stdin.resume();
