#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible Slack egress prove script.
 *
 *   node studio/connectors/egress/slack/prove.js
 *     Mapping fixtures + missing-env reject. Never HTTP. Exit 0 on match.
 *
 *   node studio/connectors/egress/slack/prove.js --gate <dir-or-file>
 *     Exit 0 if every fixture evaluates ok=true, exit 2 if any reject.
 *     Planted fixtures are expected to bite.
 *
 *   node studio/connectors/egress/slack/cli.js --dry
 *     Measured Chat stand-in (PR#11 not on main). Never HTTP.
 *
 *   node studio/connectors/egress/slack/prove.js --live
 *     Optional. Requires SLACK_BOT_TOKEN and SLACK_DM_USER_ID.
 *     Not a CI step. Refuses without both env vars — does not invent tokens.
 *
 * Node 18+. No npm install. Does not write a verdict. Does not arm the clock.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const slack = require("./index");
const contract = require("./contract");
const cli = require("./cli");

const root = path.resolve(__dirname, "..", "..", "..", "..");
const FIXTURES = path.join(__dirname, "fixtures");

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name, detail) {
  failed += 1;
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
}

function rel(abs) {
  return path.relative(root, abs) || abs;
}

function listRecords(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`no such fixture path: ${target}`);
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...listRecords(child));
    else if (entry.name.endsWith(".json")) out.push(child);
  }
  return out;
}

function extraKeys(object, allowed) {
  if (!object || typeof object !== "object") return ["<missing>"];
  return Object.keys(object).filter((key) => !allowed.includes(key)).sort();
}

function missingKeys(object, required) {
  if (!object || typeof object !== "object") return required.slice();
  return required.filter((key) => !Object.prototype.hasOwnProperty.call(object, key));
}

function bannedFetch() {
  return async function banned() {
    throw new Error("fetch was called without a live env gate");
  };
}

async function evaluateFixture(record) {
  const opts = {
    live: record.live === true,
    env: record.env && typeof record.env === "object" ? record.env : {},
    fetch: bannedFetch(),
  };
  if (record.op === "map") return slack.map(record.input);
  if (record.op === "send") return slack.send(record.input, opts);
  if (record.op === "dm") return slack.dm(record.input, opts);
  throw new Error(`fixture op must be map|send|dm, got ${JSON.stringify(record.op)}`);
}

function uniqueClosed(name, list) {
  const seen = new Set();
  for (const code of list) {
    if (seen.has(code)) fail(name, `duplicate ${code}`);
    seen.add(code);
  }
  if (seen.size === list.length) pass(`closed ${name} (${list.length})`);
}

async function checkLibrary() {
  uniqueClosed("CODES", slack.CODES);
  uniqueClosed("REPORT_FIELDS", slack.REPORT_FIELDS);

  if (typeof slack.map !== "function") fail("api", "map export missing");
  else pass("map is the dry consume export");
  if (typeof slack.send !== "function") fail("api", "send export missing");
  else pass("send is the harness export");
  if (typeof slack.dm !== "function") fail("api", "dm export missing");
  else pass("dm is the IM helper export");
  if (typeof slack.createServer === "function" || typeof slack.listen === "function") {
    fail("api", "HTTP chrome leaked on the consume export");
  } else {
    pass("no HTTP listen/createServer on consume export");
  }

  if (slack.METHODS.post_message.url !== "https://slack.com/api/chat.postMessage") {
    fail("docs", slack.METHODS.post_message.url);
  } else {
    pass("chat.postMessage URL is official");
  }
  if (slack.METHODS.conversations_open.url !== "https://slack.com/api/conversations.open") {
    fail("docs", slack.METHODS.conversations_open.url);
  } else {
    pass("conversations.open URL is official");
  }
  if (slack.OFFICIAL_DOCS.post_message !== "https://docs.slack.dev/reference/methods/chat.postMessage") {
    fail("docs", slack.OFFICIAL_DOCS.post_message);
  } else {
    pass("docs cite chat.postMessage only");
  }

  const draft = {
    provider: "slack",
    actor: "human",
    kind: "message",
    body: "library pin",
    thread_ref: { channel: "Ceng", thread_ts: "1.2" },
  };
  const mapped = slack.map(draft);
  if (mapped.verdict !== null || mapped.clock_started !== false) {
    fail("report pins", JSON.stringify({ verdict: mapped.verdict, clock_started: mapped.clock_started }));
  } else {
    pass("report keeps verdict=null and clock_started=false");
  }
  const extra = extraKeys(mapped.request, contract.POST_MESSAGE_FIELDS);
  if (extra.length) fail("map fields", `invented ${extra.join(",")}`);
  else pass("mapped request stays on official chat.postMessage args");

  let fetches = 0;
  const spy = async function spyFetch() {
    fetches += 1;
    throw new Error("spy fetch must not run");
  };

  const dry = await slack.send(draft, {
    live: false,
    env: { SLACK_BOT_TOKEN: "set-but-unused" },
    fetch: spy,
  });
  if (!dry.ok || dry.dry !== true || fetches !== 0) {
    fail("dry send", JSON.stringify({ ok: dry.ok, dry: dry.dry, fetches }));
  } else {
    pass("dry send does not HTTP even when a token name is present");
  }

  const liveNoToken = await slack.send(draft, { live: true, env: {}, fetch: spy });
  if (liveNoToken.ok || liveNoToken.code !== "NEEDS_AUTH" || fetches !== 0) {
    fail("live missing env", JSON.stringify({ ok: liveNoToken.ok, code: liveNoToken.code, fetches }));
  } else {
    pass("live send without SLACK_BOT_TOKEN is NEEDS_AUTH and does not fetch");
  }

  const dmNoEnv = await slack.dm({ text: "no user" }, { live: true, env: {}, fetch: spy });
  if (dmNoEnv.ok || dmNoEnv.code !== "NEEDS_AUTH" || fetches !== 0) {
    fail("dm missing env", JSON.stringify({ ok: dmNoEnv.ok, code: dmNoEnv.code, fetches }));
  } else {
    pass("live DM without SLACK_DM_USER_ID is NEEDS_AUTH and does not fetch");
  }

  if (typeof cli.dryRun !== "function" || typeof cli.publicReport !== "function") {
    fail("cli", "dryRun/publicReport export missing");
  } else {
    pass("cli dryRun is the Chat stand-in export");
  }

  const cliDry = await cli.dryRun(cli.loadInput(cli.DEFAULT_DRY));
  if (!cliDry.ok || cliDry.dry !== true || cliDry.request.channel !== "Ceng") {
    fail("cli dryRun", JSON.stringify({ ok: cliDry.ok, dry: cliDry.dry, request: cliDry.request }));
  } else {
    pass("cli dryRun maps the measured draft fixture");
  }

  const published = cli.publicReport(cliDry);
  const pubExtra = extraKeys(published, cli.PUBLIC_FIELDS);
  if (pubExtra.length) fail("cli publicReport", `extra ${pubExtra.join(",")}`);
  else pass("cli publicReport stays on the closed public fields");
  if (typeof published.auth_present.SLACK_BOT_TOKEN !== "boolean") {
    fail("cli publicReport", "auth_present must be booleans, never token values");
  } else {
    pass("cli publicReport reports auth presence only");
  }

  const leakProbe = cli.publicReport({
    ok: true,
    dry: true,
    request: { channel: "Ceng", text: "xoxb-should-not-print" },
    token: "xoxb-should-not-print",
    Authorization: "Bearer xoxb-should-not-print",
  });
  const leaked = JSON.stringify(leakProbe);
  if (/xoxb-should-not-print/.test(leaked) || leaked.includes("Bearer ")) {
    fail("cli redact", leaked);
  } else {
    pass("cli publicReport redacts token-shaped strings");
  }

  const childEnv = Object.assign({}, process.env);
  delete childEnv.SLACK_BOT_TOKEN;
  delete childEnv.SLACK_DM_USER_ID;
  const dryChild = spawnSync(process.execPath, [path.join(__dirname, "cli.js"), "--dry"], {
    encoding: "utf8",
    env: childEnv,
  });
  if (dryChild.status !== 0) {
    fail("cli --dry", dryChild.stderr || dryChild.stdout);
  } else {
    const body = JSON.parse(dryChild.stdout);
    if (body.ok !== true || body.dry !== true || body.verdict !== null || body.clock_started !== false) {
      fail("cli --dry", JSON.stringify(body));
    } else {
      pass("cli --dry exits 0 with dry JSON; verdict=null");
    }
  }

  const plantedChild = spawnSync(
    process.execPath,
    [path.join(__dirname, "cli.js"), "--dry", "--in", path.join(__dirname, "fixtures", "planted", "empty-body.json")],
    { encoding: "utf8", env: childEnv }
  );
  if (plantedChild.status !== 2) {
    fail("cli --dry planted", `exit ${plantedChild.status}: ${plantedChild.stdout}`);
  } else {
    pass("cli --dry of planted empty-body exits 2");
  }

  const liveChild = spawnSync(process.execPath, [path.join(__dirname, "cli.js"), "--live", "--dm"], {
    encoding: "utf8",
    env: childEnv,
  });
  if (liveChild.status !== 2 || !/NEEDS_AUTH/.test(liveChild.stdout + liveChild.stderr)) {
    fail("cli --live no env", `exit ${liveChild.status}: ${liveChild.stdout} ${liveChild.stderr}`);
  } else {
    pass("cli --live --dm without env is NEEDS_AUTH exit 2");
  }
}

function matchExpect(result, expect) {
  if (result.ok !== expect.ok) {
    return `expected ok=${expect.ok}, got ok=${result.ok} code=${result.code || "none"} detail=${result.detail || ""}`;
  }
  if (expect.ok === false) {
    if (expect.code && result.code !== expect.code) {
      return `expected code=${expect.code}, got ${result.code}`;
    }
    return null;
  }
  if (typeof expect.dry === "boolean" && result.dry !== expect.dry) {
    return `expected dry=${expect.dry}, got ${result.dry}`;
  }
  if (expect.method && result.method !== expect.method) {
    return `expected method=${expect.method}, got ${result.method}`;
  }
  if (expect.channel && (!result.request || result.request.channel !== expect.channel)) {
    return `expected channel=${expect.channel}, got ${result.request && result.request.channel}`;
  }
  if (expect.text && (!result.request || result.request.text !== expect.text)) {
    return `expected text=${JSON.stringify(expect.text)}, got ${JSON.stringify(result.request && result.request.text)}`;
  }
  if (expect.thread_ts && (!result.request || result.request.thread_ts !== expect.thread_ts)) {
    return `expected thread_ts=${expect.thread_ts}, got ${result.request && result.request.thread_ts}`;
  }
  if (expect.outbound_op && (!result.outbound || result.outbound.op !== expect.outbound_op)) {
    return `expected outbound_op=${expect.outbound_op}, got ${result.outbound && result.outbound.op}`;
  }
  return null;
}

async function checkFixtures() {
  const files = listRecords(FIXTURES);
  if (files.length === 0) fail("fixtures", "none found");

  let good = 0;
  let planted = 0;

  for (const file of files) {
    const name = rel(file);
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const expect = record.expect;
    if (!expect || typeof expect.ok !== "boolean") {
      fail(name, "fixture has no expect.ok block");
      continue;
    }

    let result;
    try {
      result = await evaluateFixture(record);
    } catch (err) {
      fail(name, `evaluate threw: ${err.message}`);
      continue;
    }

    if (result.verdict !== null || result.clock_started !== false) {
      fail(name, `pins drifted: verdict=${JSON.stringify(result.verdict)} clock_started=${result.clock_started}`);
      continue;
    }

    const reportExtra = extraKeys(result, slack.REPORT_FIELDS);
    const reportMissing = missingKeys(result, slack.REPORT_FIELDS);
    if (reportExtra.length || reportMissing.length) {
      fail(name, `report fields extra=${reportExtra.join(",")} missing=${reportMissing.join(",")}`);
      continue;
    }

    const mismatch = matchExpect(result, expect);
    if (mismatch) {
      fail(name, mismatch);
      continue;
    }

    if (expect.ok) {
      good += 1;
      pass(`${name} ${result.method || "map"} dry=${result.dry}`);
    } else {
      planted += 1;
      pass(`${name} trips ${result.code}`);
    }
  }

  if (good === 0) fail("fixtures", "no good fixtures; harness could be rejecting everything");
  if (planted === 0) fail("fixtures", "no planted fixtures; harness could be accepting everything");

  const plantedDir = path.join(FIXTURES, "planted");
  const plantedFiles = listRecords(plantedDir);
  let anyClean = false;
  for (const file of plantedFiles) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = await evaluateFixture(record);
    if (result.ok) anyClean = true;
  }
  if (anyClean) fail("gate", "a planted record cleared the harness");
  else pass("every planted record is caught");

  const plantedCodes = new Set();
  for (const file of plantedFiles) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    if (record.expect && record.expect.code) plantedCodes.add(record.expect.code);
  }
  const missing = slack.CODES.filter((code) => !plantedCodes.has(code));
  if (missing.length) fail("planted coverage", `no fixture for ${missing.join(",")}`);
  else pass(`planted fixtures cover every egress code (${slack.CODES.join(",")})`);
}

async function gate(target) {
  const files = listRecords(target);
  let dirty = 0;
  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = await evaluateFixture(record);
    if (result.ok) {
      process.stdout.write(`OK   ${rel(file)}\n`);
      continue;
    }
    dirty += 1;
    process.stderr.write(`CODE ${rel(file)} ${result.code}: ${result.detail}\n`);
  }
  process.stdout.write(
    `connectors-egress-slack gate: ${files.length - dirty}/${files.length} ok; verdict=null; clock_started=false\n`
  );
  process.exit(dirty ? 2 : 0);
}

async function live() {
  const auth = slack.processEnv();
  if (!slack.liveDmReady(auth)) {
    const missing = [];
    if (!auth.has_token) missing.push(slack.TOKEN_NAME);
    if (!auth.has_dm_user) missing.push(slack.DM_USER_NAME);
    process.stderr.write(
      JSON.stringify({
        ok: false,
        code: "NEEDS_AUTH",
        detail: `${missing.join(" + ")} missing; --live refused`,
        verdict: null,
        clock_started: false,
      }) + "\n"
    );
    process.exit(2);
  }

  const result = await slack.dm(
    { text: "studio/connectors/egress/slack prove --live" },
    { live: true, env: process.env }
  );
  process.stdout.write(
    JSON.stringify(
      {
        ok: result.ok,
        dry: result.dry,
        code: result.code,
        detail: result.detail,
        method: result.method,
        channel: result.http && result.http.channel,
        ts: result.http && result.http.ts,
        verdict: null,
        clock_started: false,
      },
      null,
      2
    ) + "\n"
  );
  process.exit(result.ok ? 0 : 2);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--live")) {
    await live();
    return;
  }
  const gateAt = argv.indexOf("--gate");
  if (gateAt !== -1) {
    const target = argv[gateAt + 1];
    if (!target) {
      process.stderr.write("--gate needs a file or directory\n");
      process.exit(2);
    }
    await gate(target);
    return;
  }

  await checkLibrary();
  await checkFixtures();
  process.stdout.write(
    `connectors egress slack ${passed} passed, ${failed} failed; verdict=null; clock_started=false; not a 14d verdict\n`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`ERROR ${err.message}\n`);
  process.exit(1);
});
