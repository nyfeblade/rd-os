"use strict";

/**
 * Slack Events API stub — signed body → Studio Ingest Schema fields.
 * Ingress is Events API / Bolt, not MCP. Does not rewrite runtime/providers/slack.js.
 */

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function innerEvent(body) {
  if (!isObject(body)) return { error: "slack body is not an object" };
  if (body.type === "url_verification") {
    return { handshake: true, challenge: typeof body.challenge === "string" ? body.challenge : "" };
  }
  if (body.type === "event_callback") {
    if (!isObject(body.event)) return { error: "event_callback needs payload.event" };
    return { envelopeEvent: "event_callback", event: body.event, payload: body };
  }
  if (typeof body.type === "string" && body.type !== "") {
    return { envelopeEvent: body.type, event: body, payload: body };
  }
  return { error: "slack body has no event type" };
}

function identityOf(event) {
  if (event.bot_id || event.subtype === "bot_message") {
    return {
      actor_kind: "bot",
      actor_id: typeof event.bot_id === "string" ? event.bot_id : String(event.user || ""),
      as_user: false,
    };
  }
  return {
    actor_kind: "user",
    actor_id: typeof event.user === "string" ? event.user : "",
    as_user: true,
  };
}

function isAtMention(text) {
  return typeof text === "string" && /<@[A-Z0-9]+(?:\|[^>]+)?>/i.test(text);
}

function atYou(event, override) {
  if (typeof override === "boolean") return override;
  if (event.type === "app_mention") return true;
  if (event.type === "message" && event.channel_type === "im" && isAtMention(event.text)) return true;
  return false;
}

function mapRequest(request) {
  const resolved = innerEvent(request.body);
  if (resolved.error) {
    return { ok: false, code: "INVALID_EVENT", detail: resolved.error };
  }
  if (resolved.handshake) {
    return { ok: true, handshake: true, challenge: resolved.challenge };
  }
  const event = resolved.event;
  if (event.type !== "app_mention" && event.type !== "message") {
    return { ok: false, code: "UNKNOWN_EVENT", detail: `slack event=${JSON.stringify(event.type)}` };
  }
  return {
    ok: true,
    event: resolved.envelopeEvent,
    at_you: atYou(event, request.at_you),
    identity: identityOf(event),
    payload: resolved.payload,
  };
}

module.exports = {
  provider: "slack",
  events: ["app_mention", "message", "event_callback"],
  mapRequest,
};
