"use strict";

/**
 * Closed sets for the P0 GitHub + Slack two-way runtime.
 * Inventing a code, op, dest, or provider here is a bug — extend the set first.
 */

const PROVIDERS = ["github", "slack"];

const TRAY_STATES = ["live", "needs_auth", "error", "idle"];

const DEST = ["chat", "board", "chat+board"];

const ACTORS = ["human", "bot"];

const INBOX_KINDS = [
  "comment",
  "review",
  "review_comment",
  "review_request",
  "ci_failure",
  "mention",
  "dm",
  "auth_failure",
];

const GITHUB_EVENTS = [
  "issue_comment",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "check_suite",
  "workflow_run",
];

const SLACK_EVENTS = ["app_mention", "message", "event_callback"];

const REPLY_KINDS = ["issue_comment", "pull_request_review_comment", "pull_request_review", "message"];

const OUTBOUND_OPS = [
  "create_issue_comment",
  "create_pull_request_review_comment",
  "create_pull_request_review",
  "post_message",
];

const CODES = [
  "BOT_SEND_NO_GATE",
  "EMPTY_BODY",
  "UNKNOWN_PROVIDER",
  "UNKNOWN_EVENT",
  "NEEDS_AUTH",
  "INVALID_EVENT",
];

const INBOX_FIELDS = [
  "id",
  "provider",
  "kind",
  "need_you",
  "dest",
  "thread_ref",
  "title",
  "body",
  "actor",
  "created_at",
  "tray_state",
];

const GATE_STATUSES = ["approved", "pending", "rejected"];

const OFFICIAL_DOCS = {
  github_webhooks: "https://docs.github.com/en/webhooks/webhook-events-and-payloads",
  github_issue_comments: "https://docs.github.com/en/rest/issues/comments",
  slack_events: "https://docs.slack.dev/apis/events-api/",
  slack_post_message: "https://docs.slack.dev/reference/methods/chat.postMessage",
};

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function fail(code, detail) {
  if (!CODES.includes(code)) {
    throw new Error(`violation code not in closed set: ${code}`);
  }
  return {
    ok: false,
    dropped: false,
    code,
    detail: detail || code,
    item: null,
    outbound: null,
  };
}

function pin(result) {
  return Object.assign({}, result, { verdict: null, clock_started: false });
}

function drop(reason) {
  return { ok: true, dropped: true, reason: reason || "NOISE", item: null, outbound: null };
}

module.exports = {
  PROVIDERS,
  TRAY_STATES,
  DEST,
  ACTORS,
  INBOX_KINDS,
  GITHUB_EVENTS,
  SLACK_EVENTS,
  REPLY_KINDS,
  OUTBOUND_OPS,
  CODES,
  INBOX_FIELDS,
  GATE_STATUSES,
  OFFICIAL_DOCS,
  isBlank,
  fail,
  pin,
  drop,
};
