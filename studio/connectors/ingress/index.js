"use strict";

/**
 * studio/connectors/ingress — GitHub + Slack webhook gateway stubs.
 *
 *   accept(request) → verify → Studio Ingest Schema → runtime.ingest → inbox
 *
 * Does not rewrite runtime providers. Linear/Sentry/Vercel stay later wire order.
 * verdict stays null. clock_started stays false.
 */

const http = require("http");
const { URL } = require("url");

const runtime = require("../runtime");
const { P0, LATER, buildEnvelope } = require("./envelope");
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

const FIXTURE_SECRETS = {
  github: "fixture-github-webhook-secret",
  slack: "fixture-slack-signing-secret",
};

const MAPPERS = {
  github,
  slack,
};

function pin(result) {
  return Object.assign({}, result, { verdict: null, clock_started: false });
}

function fail(code, detail) {
  if (!CODES.includes(code)) {
    throw new Error(`ingress code not in closed set: ${code}`);
  }
  return pin({
    ok: false,
    dropped: false,
    code,
    detail: detail || code,
    item: null,
    envelope: null,
    challenge: null,
  });
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

function accept(request, options) {
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
    return pin({
      ok: true,
      dropped: true,
      reason: "URL_VERIFICATION",
      challenge: mapped.challenge,
      item: null,
      envelope: null,
    });
  }
  if (mapped.drop) {
    return pin({
      ok: true,
      dropped: true,
      reason: mapped.drop,
      challenge: null,
      item: null,
      envelope: null,
    });
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

  return pin({
    ok: ingested.ok,
    dropped: Boolean(ingested.dropped),
    reason: ingested.reason || null,
    code: ingested.code || null,
    detail: ingested.detail || null,
    item: ingested.item || null,
    envelope: built.envelope,
    challenge: null,
    sanitized: true,
  });
}

function routeProvider(urlPath) {
  const pathname = urlPath || "";
  if (pathname === "/hooks/github" || pathname === "/github") return "github";
  if (pathname === "/hooks/slack" || pathname === "/slack") return "slack";
  return "";
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(json);
}

function statusFor(result) {
  if (result.ok) return 200;
  if (result.code === "BAD_SIGNATURE") return 401;
  if (result.code === "UNKNOWN_PROVIDER" || result.code === "UNSUPPORTED_PROVIDER") return 404;
  return 400;
}

function createServer(options) {
  const inbox = (options && options.inbox) || new Inbox();
  const opts = Object.assign({}, options, { inbox });
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method !== "POST") {
      sendJson(res, 405, pin({ ok: false, code: "INVALID_EVENT", detail: "POST only" }));
      return;
    }
    const provider = routeProvider(url.pathname);
    if (!provider) {
      sendJson(res, 404, fail("UNKNOWN_PROVIDER", `path=${url.pathname}`));
      return;
    }
    readRawBody(req)
      .then((raw) => {
        const result = accept(
          {
            provider,
            headers: req.headers,
            raw_body: raw,
          },
          opts
        );
        if (result.challenge != null) {
          sendJson(res, 200, { challenge: result.challenge, verdict: null, clock_started: false });
          return;
        }
        sendJson(res, statusFor(result), result);
      })
      .catch((err) => {
        sendJson(res, 400, fail("INVALID_EVENT", err.message));
      });
  });
}

function listen(port, options) {
  const server = createServer(options);
  return server.listen(port);
}

module.exports = {
  accept,
  createServer,
  listen,
  Inbox,
  CODES,
  FIXTURE_SECRETS,
  P0,
  LATER,
};
