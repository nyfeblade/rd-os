"use strict";

/**
 * Signature verify hooks for GitHub webhooks and Slack Events API.
 * Live secrets optional: fixtures may pass a secret or set fixture=true.
 */

const crypto = require("crypto");

const SLACK_MAX_SKEW_S = 300;

function header(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const want = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === want) return Array.isArray(value) ? String(value[0] || "") : String(value || "");
  }
  return "";
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function githubSignature(secret, rawBody) {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

function slackSignature(secret, timestamp, rawBody) {
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(base, "utf8").digest("hex");
  return `v0=${digest}`;
}

function signHeaders(provider, rawBody, secret, extras) {
  const extra = extras || {};
  if (provider === "github") {
    return { "x-hub-signature-256": githubSignature(secret, rawBody) };
  }
  if (provider === "slack") {
    const timestamp = extra.timestamp || String(Math.floor(Date.now() / 1000));
    return {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": slackSignature(secret, timestamp, rawBody),
    };
  }
  return {};
}

function verifyGithub(rawBody, headers, secret) {
  if (typeof rawBody !== "string") {
    return { ok: false, detail: "github raw_body must be a string" };
  }
  if (typeof secret !== "string" || secret === "") {
    return { ok: false, detail: "github webhook secret absent" };
  }
  const given = header(headers, "x-hub-signature-256");
  if (given === "") {
    return { ok: false, detail: "missing X-Hub-Signature-256" };
  }
  const expected = githubSignature(secret, rawBody);
  if (!timingSafeEqual(given, expected)) {
    return { ok: false, detail: "github signature mismatch" };
  }
  return { ok: true };
}

function verifySlack(rawBody, headers, secret, nowS) {
  if (typeof rawBody !== "string") {
    return { ok: false, detail: "slack raw_body must be a string" };
  }
  if (typeof secret !== "string" || secret === "") {
    return { ok: false, detail: "slack signing secret absent" };
  }
  const timestamp = header(headers, "x-slack-request-timestamp");
  const given = header(headers, "x-slack-signature");
  if (timestamp === "" || given === "") {
    return { ok: false, detail: "missing X-Slack-Signature or X-Slack-Request-Timestamp" };
  }
  if (!/^\d+$/.test(timestamp)) {
    return { ok: false, detail: "slack timestamp is not unix seconds" };
  }
  const now = Number.isFinite(nowS) ? nowS : Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > SLACK_MAX_SKEW_S) {
    return { ok: false, detail: "slack timestamp too old" };
  }
  const expected = slackSignature(secret, timestamp, rawBody);
  if (!timingSafeEqual(given, expected)) {
    return { ok: false, detail: "slack signature mismatch" };
  }
  return { ok: true };
}

function verify(provider, rawBody, headers, secret, nowS) {
  if (provider === "github") return verifyGithub(rawBody, headers, secret);
  if (provider === "slack") return verifySlack(rawBody, headers, secret, nowS);
  return { ok: false, detail: `no verify hook for provider=${provider}` };
}

module.exports = {
  SLACK_MAX_SKEW_S,
  header,
  githubSignature,
  slackSignature,
  signHeaders,
  verifyGithub,
  verifySlack,
  verify,
};
