"use strict";

/**
 * Consume-only two-way bridge. Reads studio/connectors/runtime when present.
 * This lane never writes studio/connectors/**.
 */

const fs = require("node:fs");
const path = require("node:path");
const { tryReadTwoWayWire } = require("./read-catalog");
const { ingressPresent, readIngressFixture, tryLoadIngress } = require("./read-ingress");

const P0_WIRE = ["github", "slack"];
const TRAY_DEFAULT = ["live", "needs_auth"];
const DEMO_INGEST = ["github-review-request.json", "github-issue-comment.json"];
const DEMO_QUIET = ["github-ping-dropped.json"];

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

function runtimePath() {
  return path.resolve(__dirname, "..", "..", "connectors", "runtime", "index.js");
}

function runtimePresent() {
  return fs.existsSync(runtimePath());
}

function tryLoadRuntime() {
  if (!runtimePresent()) {
    return null;
  }
  return require("../../connectors/runtime");
}

function fixturesDir() {
  return path.resolve(__dirname, "..", "..", "connectors", "runtime", "fixtures", "good");
}

function readGoodFixture(name) {
  const file = path.join(fixturesDir(), name);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fallbackWireRows() {
  return [
    { id: "github", label: "GitHub", p0_wire: true, status: "needs_auth" },
    { id: "slack", label: "Slack", p0_wire: true, status: "needs_auth" },
  ];
}

function wireRows() {
  const fromCatalog = tryReadTwoWayWire();
  if (fromCatalog.length) {
    return fromCatalog;
  }
  return fallbackWireRows();
}

function mergeWireConnectors(catalogRows) {
  const rows = (catalogRows || []).map((row) => ({ ...row }));
  for (const wire of wireRows()) {
    if (!rows.some((row) => row.id === wire.id)) {
      rows.push({ ...wire });
    }
  }
  return rows;
}

function trayStatus(status) {
  switch (status) {
    case "live":
    case "needs_auth":
      return status;
    case "error":
      return "needs_auth";
    case "disconnected":
      return "needs_auth";
    default:
      return assertNever(status);
  }
}

function shouldTrayPing(item) {
  return Boolean(item && item.need_you === true);
}

function visibleInbox(items) {
  return (items || []).filter((item) => shouldTrayPing(item));
}

function chatInbox(items) {
  return visibleInbox(items).filter((item) => item.dest === "chat" || item.dest === "chat+board");
}

function boardInbox(items) {
  return visibleInbox(items).filter((item) => item.needs_gate === true);
}

function replyKindFor(item) {
  switch (item.provider) {
    case "github":
      switch (item.kind) {
        case "review_comment":
          return "pull_request_review_comment";
        case "review":
        case "review_request":
          return "pull_request_review";
        case "comment":
        case "ci_failure":
        case "auth_failure":
          return "issue_comment";
        default:
          return "issue_comment";
      }
    case "slack":
      switch (item.kind) {
        case "mention":
        case "dm":
        case "auth_failure":
          return "message";
        default:
          return "message";
      }
    default:
      return assertNever(item.provider);
  }
}

function stubInbox() {
  return [
    {
      id: "github:review_request:your-repo:14:you",
      provider: "github",
      kind: "review_request",
      need_you: true,
      needs_gate: true,
      dest: "chat+board",
      thread_ref: { owner: "you", repo: "your-repo", issue_number: 14, pull_number: 14 },
      title: "review requested on PR #14",
      body: "please confirm Proof gate wording",
      actor: { login: "reviewer" },
      created_at: "2026-09-18T12:00:00Z",
      tray_state: "live",
    },
  ];
}

function ingestViaIngress(names) {
  const ingress = tryLoadIngress();
  if (!ingress) {
    return null;
  }
  const inbox = new ingress.Inbox();
  const reports = [];
  for (const name of names) {
    const record = readIngressFixture(name);
    if (!record || !record.request) {
      continue;
    }
    const request = Object.assign({ fixture: true }, record.request);
    const result = ingress.ingest(request, { fixture: true, inbox, tray_state: request.tray_state || "live" });
    reports.push({ name, result });
  }
  return { items: visibleInbox(inbox.list()), reports };
}

function demoInbox() {
  const fromIngress = ingestViaIngress([...DEMO_INGEST, ...DEMO_QUIET]);
  if (fromIngress && fromIngress.items.length) {
    return fromIngress.items;
  }
  const runtime = tryLoadRuntime();
  if (!runtime) {
    return stubInbox();
  }
  const items = [];
  for (const name of DEMO_INGEST) {
    const record = readGoodFixture(name);
    if (!record || record.op !== "ingest") {
      continue;
    }
    const result = runtime.ingest(record.envelope);
    if (result && result.ok && !result.dropped && result.item && shouldTrayPing(result.item)) {
      items.push(result.item);
    }
  }
  return items.length ? items : stubInbox();
}

function quietPingDropped() {
  const fromIngress = ingestViaIngress(DEMO_QUIET);
  if (!fromIngress) {
    return { dropped: true, items: [] };
  }
  const ping = fromIngress.reports[0] && fromIngress.reports[0].result;
  return {
    dropped: Boolean(ping && ping.dropped),
    items: fromIngress.items.filter(shouldTrayPing),
  };
}

function cutoverFromSeats(seats) {
  const attached = (seats || []).some((seat) => seat.kind === "bot" && seat.cutover === true);
  return { status: attached ? "attached" : "unattached", in_studio_only: attached };
}

function stubReply(draft) {
  const runtime = tryLoadRuntime();
  if (runtime) {
    return runtime.reply(draft);
  }
  if (!draft || typeof draft.bound_to !== "string" || draft.bound_to.trim() === "") {
    return { ok: false, code: "UNBOUND_REPLY", outbound: null, verdict: null, clock_started: false };
  }
  if (typeof draft.body !== "string" || draft.body.trim() === "") {
    return { ok: false, code: "EMPTY_BODY", outbound: null, verdict: null, clock_started: false };
  }
  if (draft.actor === "bot") {
    const cutover = draft.cutover;
    if (!(cutover && cutover.status === "attached" && cutover.in_studio_only === true)) {
      return { ok: false, code: "BOT_SEND_NO_CUTOVER", outbound: null, verdict: null, clock_started: false };
    }
    if (!(draft.human_gate && draft.human_gate.status === "approved")) {
      return { ok: false, code: "BOT_SEND_NO_GATE", outbound: null, verdict: null, clock_started: false };
    }
  }
  if (draft.tray_state !== "live") {
    return { ok: false, code: "NEEDS_AUTH", outbound: null, verdict: null, clock_started: false };
  }
  return {
    ok: true,
    code: null,
    outbound: { op: "stub", provider: draft.provider, actor: draft.actor, bound_to: draft.bound_to },
    verdict: null,
    clock_started: false,
  };
}

function sendReply(draft) {
  return stubReply(draft);
}

function humanGateAllows(draft) {
  const runtime = tryLoadRuntime();
  if (runtime) {
    return runtime.humanGateAllows(draft);
  }
  if (!draft || draft.actor !== "bot") {
    return true;
  }
  return Boolean(draft.human_gate && draft.human_gate.status === "approved");
}

function cutoverAllows(draft) {
  const runtime = tryLoadRuntime();
  if (runtime) {
    return runtime.cutoverAllows(draft);
  }
  if (!draft || draft.actor !== "bot") {
    return true;
  }
  const cutover = draft.cutover;
  return Boolean(cutover && cutover.status === "attached" && cutover.in_studio_only === true);
}

module.exports = {
  P0_WIRE,
  TRAY_DEFAULT,
  boardInbox,
  chatInbox,
  cutoverAllows,
  cutoverFromSeats,
  demoInbox,
  humanGateAllows,
  ingressPresent,
  quietPingDropped,
  shouldTrayPing,
  mergeWireConnectors,
  replyKindFor,
  runtimePresent,
  sendReply,
  trayStatus,
  tryLoadRuntime,
  visibleInbox,
  wireRows,
};
