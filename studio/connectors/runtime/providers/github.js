"use strict";

const { GITHUB_EVENTS, fail, drop, isBlank } = require("../contract");
const { reportItem } = require("../inbox");
const { outbound } = require("../reply");

const DOCS = {
  webhooks: "https://docs.github.com/en/webhooks/webhook-events-and-payloads",
  comments: "https://docs.github.com/en/rest/issues/comments",
};

function repoParts(payload) {
  const repo = payload && payload.repository;
  if (!repo || typeof repo !== "object") return null;
  if (typeof repo.full_name === "string" && repo.full_name.includes("/")) {
    const [owner, name] = repo.full_name.split("/");
    if (owner && name) return { owner, repo: name, full_name: repo.full_name };
  }
  const owner = repo.owner && repo.owner.login;
  const name = repo.name;
  if (isBlank(owner) || isBlank(name)) return null;
  return { owner, repo: name, full_name: `${owner}/${name}` };
}

function loginOf(user) {
  return user && typeof user.login === "string" ? user.login : "";
}

function fromIssueComment(envelope) {
  const payload = envelope.payload || {};
  if (payload.action === "deleted") return drop("NOISE");
  if (payload.action !== "created" && payload.action !== "edited") return drop("NOISE");
  const repo = repoParts(payload);
  const issue = payload.issue;
  const comment = payload.comment;
  if (!repo || !issue || !comment || !Number.isInteger(issue.number) || !Number.isInteger(comment.id)) {
    return fail("INVALID_EVENT", "issue_comment needs repository, issue.number, comment.id");
  }
  const isPr = Boolean(issue.pull_request);
  const kind = "comment";
  return reportItem({
    id: `github:${kind}:${repo.full_name}:${issue.number}:${comment.id}`,
    provider: "github",
    kind,
    need_you: true,
    dest: "chat",
    thread_ref: {
      owner: repo.owner,
      repo: repo.repo,
      issue_number: issue.number,
      pull_number: isPr ? issue.number : undefined,
      comment_id: comment.id,
      html_url: typeof comment.html_url === "string" ? comment.html_url : undefined,
    },
    title: `${isPr ? "PR" : "issue"} #${issue.number} comment${issue.title ? `: ${issue.title}` : ""}`,
    body: typeof comment.body === "string" ? comment.body : "",
    actor: { login: loginOf(comment.user) },
    created_at: typeof comment.created_at === "string" ? comment.created_at : envelope.received_at || "",
    tray_state: envelope.tray_state,
  });
}

function fromPullRequest(envelope) {
  const payload = envelope.payload || {};
  if (payload.action !== "review_requested") return drop("NOISE");
  const repo = repoParts(payload);
  const pr = payload.pull_request;
  if (!repo || !pr || !Number.isInteger(pr.number)) {
    return fail("INVALID_EVENT", "pull_request review_requested needs repository and pull_request.number");
  }
  const reviewer = loginOf(payload.requested_reviewer);
  return reportItem({
    id: `github:review_request:${repo.full_name}:${pr.number}:${reviewer || "team"}`,
    provider: "github",
    kind: "review_request",
    need_you: true,
    dest: "chat+board",
    thread_ref: {
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pr.number,
      pull_number: pr.number,
      html_url: typeof pr.html_url === "string" ? pr.html_url : undefined,
    },
    title: `review requested on PR #${pr.number}${pr.title ? `: ${pr.title}` : ""}`,
    body: reviewer ? `requested reviewer: ${reviewer}` : "review requested",
    actor: { login: loginOf(payload.sender) || loginOf(pr.user) },
    created_at: typeof pr.updated_at === "string" ? pr.updated_at : envelope.received_at || "",
    tray_state: envelope.tray_state,
  });
}

function fromReview(envelope) {
  const payload = envelope.payload || {};
  if (payload.action !== "submitted") return drop("NOISE");
  const repo = repoParts(payload);
  const pr = payload.pull_request;
  const review = payload.review;
  if (!repo || !pr || !review || !Number.isInteger(pr.number) || !Number.isInteger(review.id)) {
    return fail("INVALID_EVENT", "pull_request_review needs repository, pull_request.number, review.id");
  }
  return reportItem({
    id: `github:review:${repo.full_name}:${pr.number}:${review.id}`,
    provider: "github",
    kind: "review",
    need_you: true,
    dest: "chat",
    thread_ref: {
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pr.number,
      pull_number: pr.number,
      review_id: review.id,
      html_url: typeof review.html_url === "string" ? review.html_url : undefined,
    },
    title: `review on PR #${pr.number}${pr.title ? `: ${pr.title}` : ""}`,
    body: typeof review.body === "string" ? review.body : "",
    actor: { login: loginOf(review.user) },
    created_at: typeof review.submitted_at === "string" ? review.submitted_at : envelope.received_at || "",
    tray_state: envelope.tray_state,
  });
}

function fromReviewComment(envelope) {
  const payload = envelope.payload || {};
  if (payload.action === "deleted") return drop("NOISE");
  if (payload.action !== "created" && payload.action !== "edited") return drop("NOISE");
  const repo = repoParts(payload);
  const pr = payload.pull_request;
  const comment = payload.comment;
  if (!repo || !pr || !comment || !Number.isInteger(pr.number) || !Number.isInteger(comment.id)) {
    return fail("INVALID_EVENT", "pull_request_review_comment needs repository, pull_request.number, comment.id");
  }
  return reportItem({
    id: `github:review_comment:${repo.full_name}:${pr.number}:${comment.id}`,
    provider: "github",
    kind: "review_comment",
    need_you: true,
    dest: "chat",
    thread_ref: {
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pr.number,
      pull_number: pr.number,
      comment_id: comment.id,
      html_url: typeof comment.html_url === "string" ? comment.html_url : undefined,
    },
    title: `review comment on PR #${pr.number}${pr.title ? `: ${pr.title}` : ""}`,
    body: typeof comment.body === "string" ? comment.body : "",
    actor: { login: loginOf(comment.user) },
    created_at: typeof comment.created_at === "string" ? comment.created_at : envelope.received_at || "",
    tray_state: envelope.tray_state,
  });
}

function ciFailure(envelope, source, node) {
  if (!node || typeof node !== "object") {
    return fail("INVALID_EVENT", `${source} payload is missing`);
  }
  if (node.conclusion !== "failure") return drop("NOISE");
  const repo = repoParts(envelope.payload || {});
  if (!repo) return fail("INVALID_EVENT", `${source} needs repository`);
  const sha = typeof node.head_sha === "string" ? node.head_sha : "";
  return reportItem({
    id: `github:ci_failure:${repo.full_name}:${source}:${sha || "unknown"}`,
    provider: "github",
    kind: "ci_failure",
    need_you: true,
    dest: "board",
    thread_ref: {
      owner: repo.owner,
      repo: repo.repo,
      html_url: typeof node.html_url === "string" ? node.html_url : undefined,
    },
    title: `CI failed on ${repo.full_name}`,
    body: `${source} conclusion=failure${sha ? ` sha=${sha}` : ""}`,
    actor: { login: loginOf((envelope.payload || {}).sender) },
    created_at: typeof node.updated_at === "string" ? node.updated_at : envelope.received_at || "",
    tray_state: envelope.tray_state,
  });
}

const HANDLERS = {
  issue_comment: fromIssueComment,
  pull_request: fromPullRequest,
  pull_request_review: fromReview,
  pull_request_review_comment: fromReviewComment,
  check_suite: (envelope) => ciFailure(envelope, "check_suite", (envelope.payload || {}).check_suite),
  workflow_run: (envelope) => ciFailure(envelope, "workflow_run", (envelope.payload || {}).workflow_run),
};

function ingest(envelope) {
  const handler = HANDLERS[envelope.event];
  if (!handler) {
    return fail("UNKNOWN_EVENT", `github event=${JSON.stringify(envelope.event)}`);
  }
  return handler(envelope);
}

function replyKindToOp(kind) {
  if (kind === "issue_comment") return "create_issue_comment";
  if (kind === "pull_request_review_comment") return "create_pull_request_review_comment";
  if (kind === "pull_request_review") return "create_pull_request_review";
  return null;
}

function reply(draft) {
  const op = replyKindToOp(draft.kind);
  if (!op) return fail("INVALID_EVENT", `github cannot reply kind=${JSON.stringify(draft.kind)}`);
  const ref = draft.thread_ref || {};
  if (isBlank(ref.owner) || isBlank(ref.repo)) {
    return fail("INVALID_EVENT", "github reply needs thread_ref.owner and thread_ref.repo");
  }
  const request = { owner: ref.owner, repo: ref.repo, body: draft.body };
  if (op === "create_issue_comment") {
    if (!Number.isInteger(ref.issue_number)) {
      return fail("INVALID_EVENT", "create_issue_comment needs thread_ref.issue_number");
    }
    request.issue_number = ref.issue_number;
  } else {
    if (!Number.isInteger(ref.pull_number)) {
      return fail("INVALID_EVENT", `${op} needs thread_ref.pull_number`);
    }
    request.pull_number = ref.pull_number;
    if (op === "create_pull_request_review") request.event = "COMMENT";
    if (op === "create_pull_request_review_comment" && Number.isInteger(ref.comment_id)) {
      request.in_reply_to = ref.comment_id;
    }
  }
  return outbound({
    op,
    provider: "github",
    actor: draft.actor,
    kind: draft.kind,
    request,
    human_gate: draft.human_gate,
  });
}

module.exports = {
  provider: "github",
  events: GITHUB_EVENTS,
  handlers: HANDLERS,
  docs: DOCS,
  ingest,
  reply,
};
