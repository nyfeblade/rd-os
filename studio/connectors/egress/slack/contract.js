"use strict";

/**
 * Closed sets for Slack egress (chat.postMessage harness).
 * Inventing a code, op, or Slack host here is a bug — extend the set first.
 * Official docs only. Does not rewrite runtime/**.
 */

const CODES = [
  "NEEDS_AUTH",
  "INVALID_EVENT",
  "EMPTY_BODY",
  "UNKNOWN_PROVIDER",
  "UNKNOWN_EVENT",
];

const PROVIDERS = ["slack"];

const OUTBOUND_OPS = ["post_message"];

const ACTORS = ["human", "bot"];

const POST_MESSAGE_FIELDS = ["channel", "text", "thread_ts", "reply_broadcast"];

const OPEN_IM_FIELDS = ["users"];

const REPORT_FIELDS = [
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
  "verdict",
  "clock_started",
];

const OFFICIAL_DOCS = {
  post_message: "https://docs.slack.dev/reference/methods/chat.postMessage",
  conversations_open: "https://docs.slack.dev/reference/methods/conversations.open",
};

const METHODS = {
  post_message: {
    method: "chat.postMessage",
    url: "https://slack.com/api/chat.postMessage",
    docs: OFFICIAL_DOCS.post_message,
  },
  conversations_open: {
    method: "conversations.open",
    url: "https://slack.com/api/conversations.open",
    docs: OFFICIAL_DOCS.conversations_open,
  },
};

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function pin(result) {
  return Object.assign({}, result, { verdict: null, clock_started: false });
}

function fail(code, detail) {
  if (!CODES.includes(code)) {
    throw new Error(`violation code not in closed set: ${code}`);
  }
  return pin({
    ok: false,
    dry: true,
    code,
    detail: detail || code,
    method: null,
    url: null,
    request: null,
    identity: null,
    outbound: null,
    http: null,
    steps: null,
  });
}

function extraKeys(object, allowed) {
  if (!object || typeof object !== "object") return ["<missing>"];
  return Object.keys(object).filter((key) => !allowed.includes(key)).sort();
}

module.exports = {
  CODES,
  PROVIDERS,
  OUTBOUND_OPS,
  ACTORS,
  POST_MESSAGE_FIELDS,
  OPEN_IM_FIELDS,
  REPORT_FIELDS,
  OFFICIAL_DOCS,
  METHODS,
  isBlank,
  pin,
  fail,
  extraKeys,
};
