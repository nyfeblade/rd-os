#!/usr/bin/env node
"use strict";

const path = require("path");
const { createStudioServer } = require("../lib/http");

function parseArgs(argv) {
  const args = argv.slice(2);
  let home = process.env.STUDIO_HOME || path.join(process.cwd(), "var");
  let port = Number(process.env.PORT || 7430);
  let host = process.env.HOST || "127.0.0.1";
  let source = process.env.STUDIO_SOURCE || "fixture";
  let repo = process.env.GITHUB_REPO || "nyfeblade/rd-os";
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
    if (args[i] === "--source") {
      source = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "--repo") {
      repo = args[i + 1];
      i += 1;
      continue;
    }
    if (args[i] === "-h" || args[i] === "--help") {
      process.stdout.write(
        "Usage: studio [--port 7430] [--home var] [--source fixture|github] [--repo owner/name]\n"
      );
      process.exit(0);
    }
    throw new Error(`unknown argument: ${args[i]}`);
  }
  return { home, port, host, source, repo };
}

const parsed = parseArgs(process.argv);
if (parsed.repo) {
  process.env.GITHUB_REPO = parsed.repo;
}
const { server } = createStudioServer({
  home: parsed.home,
  root: path.resolve(__dirname, ".."),
  source: parsed.source,
});

server.listen(parsed.port, parsed.host, () => {
  const url = `http://${parsed.host}:${parsed.port}`;
  process.stdout.write(`rd-os studio C ${url}\n`);
  process.stdout.write(`source=${parsed.source} repo=${parsed.repo} home=${parsed.home}\n`);
  process.stdout.write("GitHub-like browse. Attach recipe: npm run attach. ResourceExhausted ⇒ STOP.\n");
});
