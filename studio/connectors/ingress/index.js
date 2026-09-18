"use strict";

/**
 * studio/connectors/ingress — ingest API for the Studio shell (consume-only).
 *
 *   ingest(request) → verify → Studio Ingest Schema → runtime.ingest → report
 *
 * Shell / Chat / Board require this module. No chrome, no HTTP listen, no UI.
 * Does not rewrite runtime providers. Linear/Sentry/Vercel stay later wire order.
 * verdict stays null. clock_started stays false.
 */

const runtime = require("../runtime");
const { P0, LATER, ENVELOPE_FIELDS, IDENTITY_FIELDS, buildEnvelope } = require("./envelope");
const { Inbox } = require("./inbox");
const { sanitizePayload } = require("./sanitize");
const { header, verify } = require("./verify");
const github = require("./github");
const slack = require("./slack");

const CODES = [
  "BAD_SIGNATURE",
  "UNKNOWN_PROVIDER",
  "UNSUPPORTED_PROVIDER",
  "INVALID_EVENT",
  "UNKNOWN_EVENT",
];

const REPORT_FIELDS = [
  "ok",
  "dropped",
  "code",
  "detail",
  "reason",
  "item",
  "envelope",
  "challenge",
  "verdict",
  "clock_started",
];

const INBOX_FIELDS = runtime.INBOX_FIELDS;

const FIXTURE_SECRETS = {
  github: "fixture-github-webhook-secret",
  slack: "fixture-slack-signing-secret",
};

const MAPPERS = {
  github,
  slack,
};

function report(partial) {
  return {
    ok: Boolean(partial.ok),
    dropped: Boolean(partial.dropped),
    code: partial.code || null,
    detail: partial.detail || null,
    reason: partial.reason || null,
    item: partial.item || null,
    envelope: partial.envelope || null,
    challenge: partial.challenge == null ? null : partial.challenge,
    verdict: null,
    clock_started: false,
  };
}

function fail(code, detail) {
  if (!CODES.includes(code)) {
    throw new Error(`ingress code not in closed set: ${code}`);
  }
  return report({ ok: false, code, detail: detail || code });
}

function headerProvider(headers) {
  if (header(headers, "x-github-event") || header(headers, "x-hub-signature-256")) return "github";
  if (header(headers, "x-slack-signature") || header(headers, "x-slack-request-timestamp")) return "slack";
  return "";
}

function resolveProvider(request) {
  if (request && typeof request.provider === "string" && request.provider.trim() !== "") {
    return request.provider.trim();
  }
  return headerProvider(request && request.headers);
}

function resolveSecret(provider, request, options) {
  if (request && typeof request.secret === "string" && request.secret !== "") return request.secret;
  const secrets = (options && options.secrets) || {};
  if (typeof secrets[provider] === "string" && secrets[provider] !== "") return secrets[provider];
  if (provider === "github" && process.env.GITHUB_WEBHOOK_SECRET) return process.env.GITHUB_WEBHOOK_SECRET;
  if (provider === "slack" && process.env.SLACK_SIGNING_SECRET) return process.env.SLACK_SIGNING_SECRET;
  return "";
}

function fixtureMode(request, options) {
  if (request && request.fixture === true) return true;
  if (options && options.fixture === true) return true;
  return false;
}

function materialize(request) {
  const next = Object.assign({}, request);
  if (typeof next.raw_body !== "string" && next.body != null) {
    next.raw_body = typeof next.body === "string" ? next.body : JSON.stringify(next.body);
  }
  if ((next.body == null || typeof next.body !== "object") && typeof next.raw_body === "string" && next.raw_body !== "") {
    try {
      next.body = JSON.parse(next.raw_body);
    } catch {
      next.body = null;
    }
  }
  return next;
}

function laterOrUnknown(provider) {
  if (LATER.includes(provider)) {
    return fail("UNSUPPORTED_PROVIDER", `wire order: ${provider} is later than GitHub+Slack`);
  }
  return fail("UNKNOWN_PROVIDER", `provider=${JSON.stringify(provider)}`);
}

/**
 * Shell-facing ingest API.
 * `request` is a vendor webhook (headers + body). Result.item is the inbox row
 * Chat/Board consume. Drops never become items. No HTTP server required.
 */
function ingest(request, options) {
  const opts = options || {};
  const inbox = opts.inbox || null;
  const req = materialize(request);
  const provider = resolveProvider(req);

  if (!provider) return fail("UNKNOWN_PROVIDER", "provider missing");
  if (!P0.includes(provider)) return laterOrUnknown(provider);
  if (typeof req.raw_body !== "string") return fail("INVALID_EVENT", "raw_body missing");
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return fail("INVALID_EVENT", "webhook body is not JSON");
  }

  const secret = resolveSecret(provider, req, opts);
  const unsigned = req.unsigned === true;
  if (!unsigned) {
    if (secret) {
      const nowS = typeof opts.nowS === "number" ? opts.nowS : undefined;
      const checked = verify(provider, req.raw_body, req.headers || {}, secret, nowS);
      if (!checked.ok) return fail("BAD_SIGNATURE", checked.detail);
    } else if (!fixtureMode(req, opts)) {
      return fail("BAD_SIGNATURE", "webhook secret absent (fixture=true allowed)");
    }
  } else if (!fixtureMode(req, opts)) {
    return fail("BAD_SIGNATURE", "unsigned webhook rejected outside fixture mode");
  }

  const mapper = MAPPERS[provider];
  const mapped = mapper.mapRequest(req, {
    you: Object.assign({ github: "luke", slack: "Ubot" }, opts.you || {}, req.you || {}),
  });
  if (!mapped.ok) return fail(mapped.code, mapped.detail);
  if (mapped.handshake) {
    return report({
      ok: true,
      dropped: true,
      reason: "URL_VERIFICATION",
      challenge: mapped.challenge,
    });
  }
  if (mapped.drop) {
    return report({ ok: true, dropped: true, reason: mapped.drop });
  }

  const trayState = req.tray_state || opts.tray_state || "live";
  const receivedAt = req.received_at || opts.received_at || new Date().toISOString();
  const built = buildEnvelope({
    provider,
    event: mapped.event,
    received_at: receivedAt,
    at_you: mapped.at_you,
    tray_state: trayState,
    identity: mapped.identity,
    payload: sanitizePayload(mapped.payload),
  });
  if (!built.ok) return fail(built.code, built.detail);

  const ingested = runtime.ingest(built.envelope);
  if (ingested.ok && !ingested.dropped && ingested.item && inbox) {
    inbox.push(ingested.item);
  }

  return report({
    ok: ingested.ok,
    dropped: Boolean(ingested.dropped),
    reason: ingested.reason || null,
    code: ingested.code || null,
    detail: ingested.detail || null,
    item: ingested.item || null,
    envelope: built.envelope,
  });
}

module.exports = {
  ingest,
  accept: ingest,
  Inbox,
  CODES,
  REPORT_FIELDS,
  INBOX_FIELDS,
  ENVELOPE_FIELDS,
  IDENTITY_FIELDS,
  FIXTURE_SECRETS,
  P0,
  LATER,
};
