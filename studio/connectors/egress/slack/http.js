"use strict";

/**
 * Slack Web API POST. Refuses to call Slack when the bot token is missing.
 * Official hosts only. Token stays in the Authorization header, never in the body dump.
 */

const { METHODS, fail, pin } = require("./contract");

function methodSpec(name) {
  switch (name) {
    case "chat.postMessage":
      return METHODS.post_message;
    case "conversations.open":
      return METHODS.conversations_open;
    default: {
      const _exhaustive = name;
      return { error: fail("UNKNOWN_EVENT", `slack method=${JSON.stringify(_exhaustive)}`) };
    }
  }
}

async function slackPost(methodName, request, token, fetchImpl) {
  if (!token) {
    return fail("NEEDS_AUTH", "SLACK_BOT_TOKEN missing; live HTTP refused");
  }
  const spec = methodSpec(methodName);
  if (spec.error) return spec.error;
  const fetchFn = fetchImpl || fetch;
  let response;
  try {
    response = await fetchFn(spec.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(request),
    });
  } catch (err) {
    return fail("INVALID_EVENT", `slack HTTP failed: ${err.message}`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    return fail("INVALID_EVENT", `slack response is not JSON: ${err.message}`);
  }

  if (!payload || payload.ok !== true) {
    const slackError = payload && payload.error ? payload.error : `http_${response.status}`;
    return pin({
      ok: false,
      dry: false,
      code: slackError === "invalid_auth" || slackError === "not_authed" || slackError === "token_revoked"
        ? "NEEDS_AUTH"
        : "INVALID_EVENT",
      detail: `slack ${methodName} error=${slackError}`,
      method: spec.method,
      url: spec.url,
      request,
      identity: null,
      outbound: null,
      http: { ok: false, status: response.status, error: slackError },
      steps: null,
    });
  }

  return pin({
    ok: true,
    dry: false,
    code: null,
    detail: null,
    method: spec.method,
    url: spec.url,
    request,
    identity: null,
    outbound: null,
    http: {
      ok: true,
      status: response.status,
      channel: typeof payload.channel === "string" ? payload.channel : payload.channel && payload.channel.id,
      ts: typeof payload.ts === "string" ? payload.ts : null,
      error: null,
    },
    steps: null,
  });
}

module.exports = {
  slackPost,
};
