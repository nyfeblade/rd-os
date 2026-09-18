"use strict";

/**
 * GitHub webhook stub — header event + signed body → Studio Ingest Schema fields.
 * Does not rewrite runtime/providers/github.js.
 */

const { header } = require("./verify");

const P0_EVENTS = [
  "issue_comment",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "check_suite",
  "workflow_run",
];

const DROP_EVENTS = ["ping"];

function loginOf(user) {
  return user && typeof user.login === "string" ? user.login : "";
}

function senderIdentity(payload) {
  const sender = payload && payload.sender;
  const commentUser = payload && payload.comment && payload.comment.user;
  const reviewUser = payload && payload.review && payload.review.user;
  const user = commentUser || reviewUser || sender || {};
  const type = typeof user.type === "string" ? user.type.toLowerCase() : "";
  let actor_kind = "user";
  if (loginOf(user) === "github-actions" || loginOf(sender) === "github-actions") {
    actor_kind = "app";
  } else if (type === "bot") actor_kind = "bot";
  else if (type === "app" || type === "organization") actor_kind = "app";
  return {
    actor_kind,
    actor_id: loginOf(user) || (user.id != null ? String(user.id) : ""),
    as_user: actor_kind === "user",
  };
}

function mentions(text, login) {
  if (!login || typeof text !== "string") return false;
  return text.includes(`@${login}`);
}

function prList(payload, event) {
  const node = event === "workflow_run" ? payload.workflow_run : payload.check_suite;
  const fromNode = node && Array.isArray(node.pull_requests) ? node.pull_requests : [];
  const fromRoot = Array.isArray(payload.pull_requests) ? payload.pull_requests : [];
  return fromNode.concat(fromRoot);
}

function atYou(event, payload, youLogin, override) {
  if (typeof override === "boolean") return override;
  const you = typeof youLogin === "string" ? youLogin : "";

  if (event === "check_suite" || event === "workflow_run") {
    if (!you) return false;
    for (const pr of prList(payload, event)) {
      const assignees = ((pr && pr.assignees) || []).map(loginOf);
      const reviewers = ((pr && pr.requested_reviewers) || []).map(loginOf);
      if (assignees.includes(you) || reviewers.includes(you)) return true;
    }
    return false;
  }

  if (event === "pull_request" && payload.action === "review_requested") {
    return Boolean(you && loginOf(payload.requested_reviewer) === you);
  }

  const body =
    (payload.comment && payload.comment.body) ||
    (payload.review && payload.review.body) ||
    "";
  if (mentions(body, you)) return true;

  if (
    event === "issue_comment" ||
    event === "pull_request_review" ||
    event === "pull_request_review_comment" ||
    (event === "pull_request" && payload.action === "review_requested")
  ) {
    return true;
  }
  return false;
}

function mapRequest(request, ctx) {
  const event = header(request.headers, "x-github-event") || request.event;
  if (typeof event !== "string" || event.trim() === "") {
    return { ok: false, code: "UNKNOWN_EVENT", detail: "missing X-GitHub-Event" };
  }
  if (DROP_EVENTS.includes(event)) {
    return { ok: true, drop: "PING" };
  }
  if (!P0_EVENTS.includes(event)) {
    return { ok: false, code: "UNKNOWN_EVENT", detail: `github event=${JSON.stringify(event)}` };
  }
  const payload = request.body && typeof request.body === "object" ? request.body : {};
  return {
    ok: true,
    event,
    at_you: atYou(event, payload, ctx.you && ctx.you.github, request.at_you),
    identity: senderIdentity(payload),
    payload,
  };
}

module.exports = {
  provider: "github",
  events: P0_EVENTS,
  mapRequest,
};
