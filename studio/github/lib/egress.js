"use strict";

const { reject, ok } = require("./errors");
const { parseRepo, API_ROOT, createGithubClient } = require("./github");
const { readToken } = require("./token");

const COMMENT_DOCS = "https://docs.github.com/en/rest/issues/comments";
const REVIEW_COMMENT_DOCS = "https://docs.github.com/en/rest/pulls/comments";

const OPS = {
  create_issue_comment: {
    op: "create_issue_comment",
    method: "POST",
    docs: COMMENT_DOCS,
  },
  create_pull_request_review_comment: {
    op: "create_pull_request_review_comment",
    method: "POST",
    docs: REVIEW_COMMENT_DOCS,
  },
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function resolveTarget(input) {
  if (!isObject(input)) {
    return null;
  }
  if (typeof input.repo === "string" && input.repo.includes("/")) {
    return parseRepo(input.repo);
  }
  if (input.owner && input.repo) {
    return parseRepo(`${input.owner}/${input.repo}`);
  }
  return null;
}

function issueNumberOf(input) {
  if (Number.isInteger(input.issue_number)) {
    return input.issue_number;
  }
  if (Number.isInteger(input.number)) {
    return input.number;
  }
  return null;
}

function mapIssueComment(input) {
  const target = resolveTarget(input);
  if (!target) {
    return reject("MISSING_REPO", "comment needs owner/name");
  }
  const issueNumber = issueNumberOf(input);
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    return reject("UNKNOWN_PATH", "comment needs a positive issue_number");
  }
  if (isBlank(input.body)) {
    return reject("EMPTY_BODY", "comment body is empty");
  }
  const spec = OPS.create_issue_comment;
  return ok({
    op: spec.op,
    method: spec.method,
    url: `${API_ROOT}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/issues/${issueNumber}/comments`,
    request: { body: input.body.trim() },
    docs: spec.docs,
  });
}

function mapReviewReply(input) {
  const target = resolveTarget(input);
  if (!target) {
    return reject("MISSING_REPO", "reply needs owner/name");
  }
  if (!Number.isInteger(input.pull_number) || input.pull_number < 1) {
    return reject("UNKNOWN_PATH", "review reply needs a positive pull_number");
  }
  if (!Number.isInteger(input.in_reply_to) || input.in_reply_to < 1) {
    return reject("UNKNOWN_PATH", "review reply needs in_reply_to");
  }
  if (isBlank(input.body)) {
    return reject("EMPTY_BODY", "reply body is empty");
  }
  const spec = OPS.create_pull_request_review_comment;
  return ok({
    op: spec.op,
    method: spec.method,
    url: `${API_ROOT}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/pulls/${input.pull_number}/comments`,
    request: { body: input.body.trim(), in_reply_to: input.in_reply_to },
    docs: spec.docs,
  });
}

function mapComment(input) {
  return mapIssueComment(input);
}

function mapReply(input) {
  if (isObject(input) && Number.isInteger(input.in_reply_to)) {
    return mapReviewReply(input);
  }
  return mapIssueComment(input);
}

async function send(mapped, opts) {
  if (!mapped.ok) {
    return mapped;
  }
  const live = Boolean(opts && opts.live);
  const fields = mapped.data;
  if (!live) {
    return ok({
      dry: true,
      http: null,
      op: fields.op,
      method: fields.method,
      url: fields.url,
      request: fields.request,
      docs: fields.docs,
    });
  }
  const token = await readToken(opts && opts.tokenProvider);
  if (!token) {
    return reject("NEEDS_AUTH", "GITHUB_TOKEN missing; live HTTP refused");
  }
  const client = createGithubClient({
    fetch: opts.fetch,
    tokenProvider: opts.tokenProvider,
    env: opts.env || {},
  });
  const result = await client.post(fields.url, fields.request);
  if (!result.ok) {
    return result;
  }
  return ok({
    dry: false,
    op: fields.op,
    comment: result.data,
  });
}

function comment(input, opts) {
  return send(mapComment(input), opts);
}

function reply(input, opts) {
  return send(mapReply(input), opts);
}

module.exports = {
  OPS,
  COMMENT_DOCS,
  REVIEW_COMMENT_DOCS,
  mapComment,
  mapReply,
  comment,
  reply,
};
