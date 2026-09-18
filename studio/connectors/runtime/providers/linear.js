"use strict";

const { LINEAR_EVENTS, fail, drop, isBlank } = require("../contract");
const { reportItem } = require("../inbox");
const { outbound } = require("../reply");

const DOCS = {
  webhooks: "https://linear.app/developers/webhooks",
  mcp: "https://mcp.linear.app/mcp",
  mcp_docs: "https://linear.app/docs/mcp",
  graphql: "https://linear.app/developers/graphql",
};

const QUOTE = 200;

const INJECTION = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/gi,
  /ignore\s+your\s+(instructions|programming)/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*prompt/gi,
  /\b(do\s+not\s+follow|disregard)\s+(your\s+)?(instructions|rules)/gi,
];

const SECRETS = [
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
];

const TOOL_CALL = /"tool_calls"\s*:|"name"\s*:\s*"[^"]+"\s*,\s*"arguments"/i;

function sanitizeText(text) {
  if (typeof text !== "string") return "";
  let out = text;
  for (const re of SECRETS) out = out.replace(re, "[redacted]");
  for (const re of INJECTION) out = out.replace(re, "[stripped]");
  if (TOOL_CALL.test(out)) out = "[stripped tool-call JSON]";
  const trimmed = out.trim();
  if (trimmed.length > QUOTE) return `${trimmed.slice(0, QUOTE)}…`;
  return trimmed;
}

function actorOf(payload, data) {
  const actor = (payload && payload.actor) || {};
  const user = (data && data.user) || {};
  const name = typeof actor.name === "string" ? actor.name : typeof user.name === "string" ? user.name : "";
  const id = typeof actor.id === "string" ? actor.id : typeof user.id === "string" ? user.id : "";
  return { id, name };
}

function issueIdOf(data) {
  if (!data || typeof data !== "object") return "";
  if (!isBlank(data.issueId)) return data.issueId;
  if (data.issue && !isBlank(data.issue.id)) return data.issue.id;
  return "";
}

function identifierOf(data, url) {
  if (data && !isBlank(data.identifier)) return data.identifier;
  if (data && data.issue && !isBlank(data.issue.identifier)) return data.issue.identifier;
  if (typeof url === "string") {
    const match = url.match(/\/issue\/([A-Z0-9]+-\d+)/i);
    if (match) return match[1].toUpperCase();
  }
  return "";
}

function entityUrl(payload, data) {
  if (payload && typeof payload.url === "string") return payload.url;
  if (data && typeof data.url === "string") return data.url;
  return undefined;
}

function createdAt(envelope, payload, data) {
  if (payload && typeof payload.createdAt === "string") return payload.createdAt;
  if (data && typeof data.createdAt === "string") return data.createdAt;
  return envelope.received_at || "";
}

function assigneeIdOf(data) {
  if (!data || typeof data !== "object") return "";
  if (!isBlank(data.assigneeId)) return data.assigneeId;
  if (data.assignee && !isBlank(data.assignee.id)) return data.assignee.id;
  return "";
}

function stateLabel(data) {
  if (!data || typeof data !== "object") return "";
  if (data.state && !isBlank(data.state.name)) return data.state.name;
  if (!isBlank(data.stateId)) return data.stateId;
  return "";
}

function hasUpdatedKey(updatedFrom, keys) {
  if (!updatedFrom || typeof updatedFrom !== "object") return false;
  return keys.some((key) => Object.prototype.hasOwnProperty.call(updatedFrom, key));
}

function threadRef(payload, data, extra) {
  const url = entityUrl(payload, data);
  const identifier = identifierOf(data, url);
  const issueId = issueIdOf(data) || data.id;
  const ref = { issue_id: issueId };
  if (identifier) ref.identifier = identifier;
  if (url) ref.url = url;
  return Object.assign(ref, extra || {});
}

function reportAssigned(envelope, payload, data) {
  const url = entityUrl(payload, data);
  const identifier = identifierOf(data, url) || data.id;
  const assignee = (data.assignee && data.assignee.name) || assigneeIdOf(data);
  const titleText = typeof data.title === "string" ? data.title : "";
  return reportItem({
    id: `linear:assigned:${identifier}`,
    provider: "linear",
    kind: "assigned",
    need_you: true,
    dest: "chat",
    thread_ref: threadRef(payload, data),
    title: `assigned ${identifier}${titleText ? `: ${sanitizeText(titleText)}` : ""}`,
    body: sanitizeText(
      typeof data.description === "string" && data.description ? data.description : `assigned to ${assignee}`
    ),
    actor: actorOf(payload, data),
    created_at: createdAt(envelope, payload, data),
    tray_state: envelope.tray_state,
  });
}

function reportStatus(envelope, payload, data) {
  const url = entityUrl(payload, data);
  const identifier = identifierOf(data, url) || data.id;
  const state = stateLabel(data);
  const titleText = typeof data.title === "string" ? data.title : "";
  return reportItem({
    id: `linear:status:${identifier}:${data.stateId || state || "unknown"}`,
    provider: "linear",
    kind: "status",
    need_you: true,
    dest: "chat",
    thread_ref: threadRef(payload, data),
    title: `status ${identifier}${titleText ? `: ${sanitizeText(titleText)}` : ""}`,
    body: sanitizeText(state ? `status → ${state}` : data.description || "status changed"),
    actor: actorOf(payload, data),
    created_at: createdAt(envelope, payload, data),
    tray_state: envelope.tray_state,
  });
}

function fromIssue(envelope) {
  const payload = envelope.payload || {};
  if (payload.action === "remove") return drop("NOISE");
  if (payload.action !== "create" && payload.action !== "update") return drop("NOISE");
  const data = payload.data;
  if (!data || typeof data !== "object" || isBlank(data.id)) {
    return fail("INVALID_EVENT", "Issue needs data.id");
  }
  if (envelope.at_you === false) return drop("NOT_AT_YOU");

  const updatedFrom = payload.updatedFrom && typeof payload.updatedFrom === "object" ? payload.updatedFrom : {};
  const assigned =
    (payload.action === "create" && Boolean(assigneeIdOf(data))) ||
    (payload.action === "update" &&
      hasUpdatedKey(updatedFrom, ["assigneeId", "assignee"]) &&
      Boolean(assigneeIdOf(data)));
  const statusChanged = payload.action === "update" && hasUpdatedKey(updatedFrom, ["stateId", "state"]);

  if (assigned) return reportAssigned(envelope, payload, data);
  if (statusChanged) return reportStatus(envelope, payload, data);
  return drop("NOISE");
}

function fromComment(envelope) {
  const payload = envelope.payload || {};
  if (payload.action === "remove") return drop("NOISE");
  if (payload.action !== "create" && payload.action !== "update") return drop("NOISE");
  if (envelope.at_you === false) return drop("NOT_AT_YOU");
  const data = payload.data;
  const issueId = issueIdOf(data);
  if (!data || typeof data !== "object" || isBlank(data.id) || isBlank(issueId)) {
    return fail("INVALID_EVENT", "Comment needs data.id and issueId");
  }
  const url = entityUrl(payload, data);
  const identifier = identifierOf(data, url);
  const titleText = data.issue && typeof data.issue.title === "string" ? data.issue.title : "";
  return reportItem({
    id: `linear:comment:${issueId}:${data.id}`,
    provider: "linear",
    kind: "comment",
    need_you: true,
    dest: "chat",
    thread_ref: threadRef(payload, data, { comment_id: data.id, issue_id: issueId }),
    title: `comment ${identifier || issueId}${titleText ? `: ${sanitizeText(titleText)}` : ""}`,
    body: sanitizeText(typeof data.body === "string" ? data.body : ""),
    actor: actorOf(payload, data),
    created_at: createdAt(envelope, payload, data),
    tray_state: envelope.tray_state,
  });
}

const HANDLERS = {
  Issue: fromIssue,
  Comment: fromComment,
};

function ingest(envelope) {
  const handler = HANDLERS[envelope.event];
  if (!handler) {
    return fail("UNKNOWN_EVENT", `linear event=${JSON.stringify(envelope.event)}`);
  }
  return handler(envelope);
}

function replyIssueId(ref) {
  if (!isBlank(ref.issueId)) return ref.issueId;
  if (!isBlank(ref.issue_id)) return ref.issue_id;
  if (!isBlank(ref.identifier)) return ref.identifier;
  return "";
}

function reply(draft) {
  if (draft.kind !== "comment") {
    return fail("INVALID_EVENT", `linear cannot reply kind=${JSON.stringify(draft.kind)}`);
  }
  const ref = draft.thread_ref || {};
  const issueId = replyIssueId(ref);
  if (isBlank(issueId)) {
    return fail("INVALID_EVENT", "linear reply needs thread_ref.issue_id or identifier");
  }
  const request = { issueId, body: draft.body };
  if (!isBlank(ref.parentId)) request.parentId = ref.parentId;
  else if (!isBlank(ref.comment_id)) request.parentId = ref.comment_id;
  return outbound({
    op: "create_comment",
    provider: "linear",
    actor: draft.actor,
    kind: "comment",
    bound_to: draft.bound_to,
    request,
    human_gate: draft.human_gate,
  });
}

module.exports = {
  provider: "linear",
  events: LINEAR_EVENTS,
  handlers: HANDLERS,
  docs: DOCS,
  ingest,
  reply,
};
