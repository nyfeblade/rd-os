#!/usr/bin/env node
"use strict";

const { createMcpServer, attachStdio } = require("../src/mcp-server");

const server = createMcpServer({
  home: process.env.RDOS_HOME,
  actor: process.env.RDOS_ACTOR || "agent",
});

attachStdio(server, process.stdin, process.stdout);
process.stdin.resume();
