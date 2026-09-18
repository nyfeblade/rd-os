"use strict";

/**
 * Runtime-style draft / closed outbound `post_message` → official chat.postMessage args.
 * Consume outbound shape only. No HTTP. No invented Slack hosts or fields.
 */

const {
  ACTORS,
  METHODS,
  POST_MESSAGE_FIELDS,
  fail,
  isBlank,
  pin,
} = require("./contract");

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identityOf(actor) {
  const kind = ACTORS.includes(actor) ? actor : "bot";
  return {
    actor_kind: kind === "human" ? "user" : "bot",
    actor_id: "",
    as_user: false,
  };
}

function pickPostMessage(request) {
  const body = {
    channel: request.channel.trim(),
    text: request.text,
  };
  if (!isBlank(request.thread_ts)) body.thread_ts = request.thread_ts.trim();
  if (request.reply_broadcast === true) body.reply_broadcast = true;
  return body;
}

function requestFromDraft(draft) {
  const ref = isObject(draft.thread_ref) ? draft.thread_ref : {};
  const nested = isObject(draft.request) ? draft.request : {};
  const channel = !isBlank(nested.channel) ? nested.channel : ref.channel;
  const text = !isBlank(nested.text) ? nested.text : draft.body;
  const threadTs = !isBlank(nested.thread_ts) ? nested.thread_ts : ref.thread_ts;
  return {
    channel,
    text,
    thread_ts: threadTs,
    reply_broadcast: nested.reply_broadcast === true,
  };
}

function requestFromOutbound(outbound) {
  const nested = isObject(outbound.request) ? outbound.request : {};
  const text = !isBlank(nested.text) ? nested.text : nested.body;
  return {
    channel: nested.channel,
    text,
    thread_ts: nested.thread_ts,
    reply_broadcast: nested.reply_broadcast === true,
  };
}

function lookLikeDraft(input) {
  return isObject(input.draft) || isObject(input.thread_ref) || (input.body != null && input.provider != null);
}

function unwrap(input) {
  if (isObject(input.outbound)) return { kind: "outbound", value: input.outbound };
  if (input.op === "post_message") return { kind: "outbound", value: input };
  if (isObject(input.draft)) return { kind: "draft", value: input.draft };
  if (lookLikeDraft(input)) return { kind: "draft", value: input };
  if (isObject(input.request) || !isBlank(input.channel)) {
    return { kind: "outbound", value: { op: "post_message", provider: "slack", request: input.request || input } };
  }
  return { kind: "unknown", value: input };
}

function validateProvider(provider) {
  if (provider == null || provider === "") return null;
  if (provider !== "slack") return fail("UNKNOWN_PROVIDER", `provider=${JSON.stringify(provider)}`);
  return null;
}

function validateOp(op) {
  if (op == null || op === "") return null;
  if (op !== "post_message") return fail("UNKNOWN_EVENT", `op=${JSON.stringify(op)} is not post_message`);
  return null;
}

function validateRequest(raw) {
  if (!isObject(raw)) return { error: fail("INVALID_EVENT", "post_message needs a request object") };
  if (isBlank(raw.channel)) return { error: fail("INVALID_EVENT", "chat.postMessage needs channel") };
  if (isBlank(raw.text)) return { error: fail("EMPTY_BODY", "chat.postMessage needs text") };
  const request = pickPostMessage({
    channel: raw.channel,
    text: raw.text.trim(),
    thread_ts: raw.thread_ts,
    reply_broadcast: raw.reply_broadcast,
  });
  const extra = Object.keys(request).filter((key) => !POST_MESSAGE_FIELDS.includes(key));
  if (extra.length) return { error: fail("INVALID_EVENT", `invented field ${extra.join(",")}`) };
  return { request };
}

function mappedReport(request, actor) {
  const method = METHODS.post_message;
  return pin({
    ok: true,
    dry: true,
    code: null,
    detail: null,
    method: method.method,
    url: method.url,
    request,
    identity: identityOf(actor),
    outbound: {
      op: "post_message",
      provider: "slack",
      request,
    },
    http: null,
    steps: null,
  });
}

function map(input) {
  if (!isObject(input)) return fail("INVALID_EVENT", "egress input is not an object");

  const badOp = validateOp(input.op);
  if (badOp) return badOp;

  const opened = unwrap(input);
  if (opened.kind === "unknown") {
    return fail("INVALID_EVENT", "need runtime draft, closed post_message outbound, or {channel,text}");
  }

  if (opened.kind === "outbound") {
    const outbound = opened.value;
    const providerErr = validateProvider(outbound.provider);
    if (providerErr) return providerErr;
    const opErr = validateOp(outbound.op);
    if (opErr) return opErr;
    const checked = validateRequest(requestFromOutbound(outbound));
    if (checked.error) return checked.error;
    return mappedReport(checked.request, outbound.actor);
  }

  const draft = opened.value;
  const providerErr = validateProvider(draft.provider);
  if (providerErr) return providerErr;
  const opErr = validateOp(draft.op);
  if (opErr) return opErr;
  if (draft.kind != null && draft.kind !== "message") {
    return fail("INVALID_EVENT", `slack egress cannot send kind=${JSON.stringify(draft.kind)}`);
  }
  const checked = validateRequest(requestFromDraft(draft));
  if (checked.error) return checked.error;
  return mappedReport(checked.request, draft.actor);
}

function mapOpenIm(userId) {
  if (isBlank(userId)) return fail("NEEDS_AUTH", "SLACK_DM_USER_ID missing; conversations.open refused");
  const method = METHODS.conversations_open;
  const request = { users: userId.trim() };
  return pin({
    ok: true,
    dry: true,
    code: null,
    detail: null,
    method: method.method,
    url: method.url,
    request,
    identity: identityOf("bot"),
    outbound: null,
    http: null,
    steps: null,
  });
}

module.exports = {
  map,
  mapOpenIm,
  identityOf,
};
