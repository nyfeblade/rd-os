#!/usr/bin/env node
"use strict";

/**
 * Interim Chat composer stand-in until studio/shell Chat (PR#11) is on main.
 *
 * Lead approved this CLI/gate path. Default is DRY. Secrets never live in the
 * repo — live HTTP reads process.env only. Does not write a verdict.
 *
 *   node studio/connectors/egress/slack/cli.js
 *   node studio/connectors/egress/slack/cli.js --dry
 *     Dry-run the measured draft fixture (or --in <file>). Never HTTP.
 *
 *   node studio/connectors/egress/slack/cli.js --dry --dm
 *     Dry-run conversations.open + postMessage mapping.
 *
 *   node studio/connectors/egress/slack/cli.js --prove
 *   node studio/connectors/egress/slack/cli.js --gate <dir-or-file>
 *
 *   node studio/connectors/egress/slack/cli.js --live --dm
 *   node studio/connectors/egress/slack/cli.js --live --in outbound.json
 *     Env-gated. Not CI. Requires SLACK_BOT_TOKEN; --dm also needs SLACK_DM_USER_ID.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { fail } = require("./contract");
const slack = require("./index");

const DEFAULT_DRY = path.join(__dirname, "fixtures", "good", "draft-thread.json");
const DEFAULT_DM_DRY = path.join(__dirname, "fixtures", "good", "dm-dry.json");

const PUBLIC_FIELDS = [
  "ok",
  "dry",
  "code",
  "detail",
  "method",
  "url",
  "request",
  "identity",
  "outbound",
  "http",
  "steps",
  "auth_present",
  "verdict",
  "clock_started",
];

const SECRET_KEY = /token|secret|authorization|password|xox[bap]/i;

function usage(stream) {
  stream.write(`Usage:
  node studio/connectors/egress/slack/cli.js --dry [--in file.json] [--out file.json]
  node studio/connectors/egress/slack/cli.js --dry --dm
  node studio/connectors/egress/slack/cli.js --prove
  node studio/connectors/egress/slack/cli.js --gate <dir-or-file>
  node studio/connectors/egress/slack/cli.js --live --dm
  node studio/connectors/egress/slack/cli.js --live --in outbound.json
`);
}

function authPresent() {
  const auth = slack.processEnv();
  return {
    SLACK_BOT_TOKEN: auth.has_token,
    SLACK_DM_USER_ID: auth.has_dm_user,
  };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "string" && /xox[bap]-/i.test(value)) return "[redacted]";
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value)) {
    if (SECRET_KEY.test(key)) {
      const raw = value[key];
      if (typeof raw === "boolean") {
        out[key] = raw;
        continue;
      }
      out[key] = typeof raw === "string" && raw.trim() ? "[present]" : null;
      continue;
    }
    out[key] = redact(value[key]);
  }
  return out;
}

function publicReport(result) {
  const src = result && typeof result === "object" ? result : {};
  const picked = {
    ok: Boolean(src.ok),
    dry: src.dry !== false,
    code: src.code || null,
    detail: src.detail || null,
    method: src.method || null,
    url: src.url || null,
    request: src.request || null,
    identity: src.identity || null,
    outbound: src.outbound || null,
    http: src.http || null,
    steps: src.steps || null,
    auth_present: authPresent(),
    verdict: null,
    clock_started: false,
  };
  return redact(picked);
}

function loadInput(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`--in file not found: ${file}`);
  const record = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("input JSON must be an object");
  }
  if (record.input && typeof record.input === "object") return record.input;
  if (record.draft && typeof record.draft === "object") return record.draft;
  return record;
}

async function dryRun(input, opts) {
  const dm = Boolean(opts && opts.dm);
  if (dm) return slack.dm(input, { live: false, env: {} });
  return slack.send(input, { live: false, env: {} });
}

async function liveRun(input, opts) {
  const dm = Boolean(opts && opts.dm);
  const auth = slack.processEnv();
  if (dm) {
    if (!slack.liveDmReady(auth)) {
      const missing = [];
      if (!auth.has_token) missing.push(slack.TOKEN_NAME);
      if (!auth.has_dm_user) missing.push(slack.DM_USER_NAME);
      return fail("NEEDS_AUTH", `${missing.join(" + ")} missing; --live refused`);
    }
    return slack.dm(input, { live: true, env: process.env });
  }
  if (!slack.liveReady(auth)) {
    return fail("NEEDS_AUTH", `${slack.TOKEN_NAME} missing; --live refused`);
  }
  return slack.send(input, { live: true, env: process.env });
}

function parseArgs(argv) {
  const out = {
    mode: "dry",
    dm: false,
    inPath: null,
    outPath: null,
    gateTarget: null,
  };
  const args = argv.slice();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        out.mode = "help";
        break;
      case "--prove":
        out.mode = "prove";
        break;
      case "--gate":
        out.mode = "gate";
        out.gateTarget = args[i + 1] || null;
        i += 1;
        break;
      case "--live":
        out.mode = "live";
        break;
      case "--dry":
        if (out.mode !== "live") out.mode = "dry";
        break;
      case "--dm":
        out.dm = true;
        break;
      case "--in":
        out.inPath = args[i + 1] || null;
        i += 1;
        break;
      case "--out":
        out.outPath = args[i + 1] || null;
        i += 1;
        break;
      default: {
        if (arg.startsWith("-")) return { mode: "error", message: `unknown flag: ${arg}` };
        if (!out.inPath) out.inPath = arg;
        else return { mode: "error", message: `unexpected argument: ${arg}` };
      }
    }
  }
  return out;
}

function forwardToProve(args) {
  const child = spawnSync(process.execPath, [path.join(__dirname, "prove.js"), ...args], {
    stdio: "inherit",
  });
  process.exit(child.status == null ? 1 : child.status);
}

function writeReport(report, outPath) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(text);
  if (outPath) fs.writeFileSync(path.resolve(outPath), text);
}

function defaultInputPath(parsed) {
  if (parsed.inPath) return parsed.inPath;
  return parsed.dm ? DEFAULT_DM_DRY : DEFAULT_DRY;
}

async function runParsed(parsed) {
  switch (parsed.mode) {
    case "help":
      usage(process.stdout);
      return 0;
    case "error":
      process.stderr.write(`${parsed.message}\n`);
      usage(process.stderr);
      return 2;
    case "prove":
      forwardToProve([]);
      return 0;
    case "gate":
      if (!parsed.gateTarget) {
        process.stderr.write("--gate needs a file or directory\n");
        return 2;
      }
      forwardToProve(["--gate", parsed.gateTarget]);
      return 0;
    case "dry": {
      const input = loadInput(defaultInputPath(parsed));
      const result = await dryRun(input, { dm: parsed.dm });
      writeReport(publicReport(result), parsed.outPath);
      return result.ok ? 0 : 2;
    }
    case "live": {
      if (!parsed.dm && !parsed.inPath) {
        process.stderr.write("--live needs --in <outbound.json> or --dm\n");
        return 2;
      }
      const input = parsed.inPath
        ? loadInput(parsed.inPath)
        : { text: "studio/connectors/egress/slack cli --live --dm" };
      const result = await liveRun(input, { dm: parsed.dm });
      writeReport(publicReport(result), parsed.outPath);
      return result.ok ? 0 : 2;
    }
    default: {
      const _exhaustive = parsed.mode;
      process.stderr.write(`unhandled cli mode: ${JSON.stringify(_exhaustive)}\n`);
      return 2;
    }
  }
}

async function main(argv) {
  const parsed = parseArgs(argv);
  const code = await runParsed(parsed);
  process.exit(code);
}

module.exports = {
  PUBLIC_FIELDS,
  authPresent,
  publicReport,
  loadInput,
  dryRun,
  liveRun,
  parseArgs,
  DEFAULT_DRY,
  DEFAULT_DM_DRY,
};

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`ERROR ${err.message}\n`);
    process.exit(1);
  });
}
