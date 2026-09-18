"use strict";

/**
 * studio/connectors/egress/slack — contract → HTTP harness for chat.postMessage.
 *
 *   map(input)            → official args. Never HTTP.
 *   send(input, opts)     → map; live POST only when opts.live and SLACK_BOT_TOKEN.
 *   dm(input, opts)       → conversations.open + postMessage to IM.
 *
 * Default is DRY. Tokens are never invented. Slack is never called without env.
 * Shell / seats consume this export later. This lane does not wire chrome.
 * verdict stays null. clock_started stays false.
 */

const { CODES, METHODS, OFFICIAL_DOCS, REPORT_FIELDS, fail, pin } = require("./contract");
const { TOKEN_NAME, DM_USER_NAME, envOf, processEnv, liveReady, liveDmReady } = require("./env");
const { map, mapOpenIm } = require("./map");
const { slackPost } = require("./http");

function resolveEnv(opts) {
  if (opts && opts.env && typeof opts.env === "object") return envOf(opts.env);
  return envOf({});
}

function attach(mapped, extra) {
  return pin(Object.assign({}, mapped, extra));
}

async function send(input, opts) {
  const mapped = map(input);
  if (!mapped.ok) return mapped;

  const live = Boolean(opts && opts.live);
  if (!live) {
    return attach(mapped, { dry: true, http: null });
  }

  const auth = resolveEnv(opts);
  if (!liveReady(auth)) {
    return fail("NEEDS_AUTH", `${TOKEN_NAME} missing; live HTTP refused`);
  }

  const posted = await slackPost("chat.postMessage", mapped.request, auth.token, opts && opts.fetch);
  if (!posted.ok) {
    return attach(posted, {
      identity: mapped.identity,
      outbound: mapped.outbound,
    });
  }
  return attach(mapped, {
    dry: false,
    http: posted.http,
  });
}

function dmUserOf(input, auth) {
  if (input && typeof input.user === "string" && input.user.trim()) return input.user.trim();
  if (input && typeof input.users === "string" && input.users.trim()) return input.users.trim();
  return auth.dm_user_id;
}

function dmTextOf(input) {
  if (!input || typeof input !== "object") return "";
  if (typeof input.text === "string") return input.text;
  if (typeof input.body === "string") return input.body;
  return "";
}

async function dm(input, opts) {
  const live = Boolean(opts && opts.live);
  const auth = resolveEnv(opts);
  const userId = dmUserOf(input, auth);
  const opened = mapOpenIm(userId);
  if (!opened.ok) return opened;

  const textSource = input && typeof input === "object" ? input : { text: "" };
  const mapped = map({
    op: "post_message",
    provider: "slack",
    actor: "bot",
    request: {
      channel: userId,
      text: dmTextOf(textSource),
    },
  });
  if (!mapped.ok) return mapped;

  const steps = [
    {
      method: opened.method,
      url: opened.url,
      request: opened.request,
      docs: METHODS.conversations_open.docs,
    },
    {
      method: mapped.method,
      url: mapped.url,
      request: { text: mapped.request.text, channel: "<im from conversations.open>" },
      docs: METHODS.post_message.docs,
    },
  ];

  if (!live) {
    return attach(mapped, {
      dry: true,
      method: mapped.method,
      request: mapped.request,
      steps,
      http: null,
    });
  }

  if (!auth.has_token) {
    return fail("NEEDS_AUTH", `${TOKEN_NAME} missing; live DM refused`);
  }

  const openHttp = await slackPost("conversations.open", opened.request, auth.token, opts && opts.fetch);
  if (!openHttp.ok) {
    return attach(openHttp, {
      identity: mapped.identity,
      outbound: mapped.outbound,
      steps,
    });
  }

  const imChannel = openHttp.http && openHttp.http.channel;
  if (!imChannel) {
    return fail("INVALID_EVENT", "conversations.open returned no channel id");
  }

  const postMapped = map({
    op: "post_message",
    provider: "slack",
    actor: "bot",
    request: { channel: imChannel, text: mapped.request.text },
  });
  if (!postMapped.ok) return postMapped;

  const posted = await slackPost("chat.postMessage", postMapped.request, auth.token, opts && opts.fetch);
  const liveSteps = [
    Object.assign({}, steps[0], { http: openHttp.http }),
    Object.assign({}, steps[1], { request: postMapped.request, http: posted.http }),
  ];
  if (!posted.ok) {
    return attach(posted, {
      identity: postMapped.identity,
      outbound: postMapped.outbound,
      steps: liveSteps,
    });
  }
  return attach(postMapped, {
    dry: false,
    http: posted.http,
    steps: liveSteps,
  });
}

module.exports = {
  map,
  send,
  dm,
  envOf,
  processEnv,
  CODES,
  REPORT_FIELDS,
  OFFICIAL_DOCS,
  METHODS,
  TOKEN_NAME,
  DM_USER_NAME,
  liveReady,
  liveDmReady,
};
