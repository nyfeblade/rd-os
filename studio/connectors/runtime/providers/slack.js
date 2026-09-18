"use strict";

const { SLACK_EVENTS, fail, drop, isBlank } = require("../contract");
const { reportItem } = require("../inbox");
const { outbound } = require("../reply");

const DOCS = {
  events: "https://docs.slack.dev/apis/events-api/",
  post_message: "https://docs.slack.dev/reference/methods/chat.postMessage",
};

function innerEvent(envelope) {
  const payload = envelope.payload || {};
  if (envelope.event === "event_callback") {
    if (!payload.event || typeof payload.event !== "object") {
      return { error: fail("INVALID_EVENT", "event_callback needs payload.event") };
    }
    return { event: payload.event };
  }
  if (payload.type && payload.type !== "event_callback") {
    return { event: payload };
  }
  return { event: Object.assign({ type: envelope.event }, payload) };
}

function slackTime(ts, fallback) {
  if (typeof ts !== "string" || ts === "") return fallback || "";
  const n = Number(ts);
  if (!Number.isFinite(n)) return ts;
  return new Date(n * 1000).toISOString();
}

function fromMention(envelope, event) {
  if (isBlank(event.channel) || isBlank(event.ts)) {
    return fail("INVALID_EVENT", "app_mention needs channel and ts");
  }
  return reportItem({
    id: `slack:mention:${event.channel}:${event.ts}`,
    provider: "slack",
    kind: "mention",
    need_you: true,
    dest: "chat",
    thread_ref: {
      channel: event.channel,
      ts: event.ts,
      thread_ts: typeof event.thread_ts === "string" ? event.thread_ts : event.ts,
      team: typeof event.team === "string" ? event.team : undefined,
    },
    title: `mention in ${event.channel}`,
    body: typeof event.text === "string" ? event.text : "",
    actor: { id: typeof event.user === "string" ? event.user : "" },
    created_at: slackTime(event.ts, envelope.received_at),
    tray_state: envelope.tray_state,
  });
}

function fromMessage(envelope, event) {
  if (event.channel_type === "im") {
    if (isBlank(event.channel) || isBlank(event.ts)) {
      return fail("INVALID_EVENT", "im message needs channel and ts");
    }
    return reportItem({
      id: `slack:dm:${event.channel}:${event.ts}`,
      provider: "slack",
      kind: "dm",
      need_you: true,
      dest: "chat",
      thread_ref: {
        channel: event.channel,
        ts: event.ts,
        thread_ts: typeof event.thread_ts === "string" ? event.thread_ts : event.ts,
        team: typeof event.team === "string" ? event.team : undefined,
      },
      title: `DM from ${event.user || "unknown"}`,
      body: typeof event.text === "string" ? event.text : "",
      actor: { id: typeof event.user === "string" ? event.user : "" },
      created_at: slackTime(event.ts, envelope.received_at),
      tray_state: envelope.tray_state,
    });
  }
  return drop("NOISE");
}

const HANDLERS = {
  app_mention: fromMention,
  message: fromMessage,
};

function ingest(envelope) {
  const resolved = innerEvent(envelope);
  if (resolved.error) return resolved.error;
  const event = resolved.event;
  const handler = HANDLERS[event.type];
  if (!handler) {
    return fail("UNKNOWN_EVENT", `slack event=${JSON.stringify(event.type)}`);
  }
  return handler(envelope, event);
}

function reply(draft) {
  if (draft.kind !== "message") {
    return fail("INVALID_EVENT", `slack cannot reply kind=${JSON.stringify(draft.kind)}`);
  }
  const ref = draft.thread_ref || {};
  if (isBlank(ref.channel)) {
    return fail("INVALID_EVENT", "slack reply needs thread_ref.channel");
  }
  const request = { channel: ref.channel, text: draft.body };
  if (!isBlank(ref.thread_ts)) request.thread_ts = ref.thread_ts;
  return outbound({
    op: "post_message",
    provider: "slack",
    actor: draft.actor,
    kind: "message",
    request,
    human_gate: draft.human_gate,
  });
}

module.exports = {
  provider: "slack",
  events: SLACK_EVENTS,
  handlers: HANDLERS,
  docs: DOCS,
  ingest,
  reply,
};
