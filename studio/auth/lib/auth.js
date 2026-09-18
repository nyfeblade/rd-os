"use strict";

const os = require("os");
const path = require("path");
const { ok, reject, isNonEmptyString, isObject } = require("./result");
const { SCHEMA, PUBLIC, PROVIDER, PENDING_TTL_MS } = require("./codes");
const { parseConfig } = require("./config");
const { createPkce, randomState } = require("./pkce");
const {
  saveSession,
  loadSession,
  savePending,
  loadPending,
  clearPending,
  clearAll,
} = require("./store");
const { sessionFromToken, publicSession, isExpired, asIso } = require("./session");

const DEFAULT_REDIRECT = "http://127.0.0.1:7450/auth/callback";

function defaultHome(platform) {
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "AI Coding Studio", "auth");
  }
  return null;
}

function bind(opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const platform = options.platform || process.platform;
  if (platform === "win32") {
    return { blocked: reject("PLATFORM_UNSUPPORTED", "win32") };
  }
  const home = options.home || defaultHome(platform);
  if (!home) {
    return { blocked: reject("PLATFORM_UNSUPPORTED", platform) };
  }
  const env = options.env || process.env;
  const config = parseConfig(env);
  if (!config.ok) {
    return { blocked: config };
  }
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const fetchImpl = options.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  const redirectTo = isNonEmptyString(options.redirectTo) ? options.redirectTo.trim() : DEFAULT_REDIRECT;
  const memory = { session: null, ticket: null };
  return {
    blocked: null,
    home,
    platform,
    config: config.data,
    now,
    fetchImpl,
    redirectTo,
    memory,
  };
}

function authorizeUrl(config, pending) {
  const url = new URL("/auth/v1/authorize", `${config.supabaseUrl}/`);
  url.searchParams.set("provider", PROVIDER);
  url.searchParams.set("redirect_to", pending.redirectTo);
  url.searchParams.set("code_challenge", pending.challenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("apikey", config.supabaseAnonKey);
  return url.toString();
}

function callbackRedirectTo(base, state) {
  const url = new URL(base);
  url.searchParams.set("state", state);
  return url.toString();
}

function parseCallbackInput(input) {
  if (typeof input === "string") {
    return parseCallbackInput({ url: input });
  }
  if (!isObject(input)) {
    return reject("BAD_ARGUMENT", "callback input is required");
  }
  if (isNonEmptyString(input.url)) {
    let parsed;
    try {
      parsed = new URL(input.url);
    } catch (err) {
      return reject("BAD_ARGUMENT", err && err.message ? err.message : "invalid callback url");
    }
    if (parsed.hash && /access_token=/.test(parsed.hash)) {
      return reject("IMPLICIT_FLOW", "url hash carried an access_token");
    }
    const error = parsed.searchParams.get("error");
    const errorCode = parsed.searchParams.get("error_code") || "";
    const description = parsed.searchParams.get("error_description") || "";
    if (error === "access_denied") {
      return reject("OAUTH_DENIED", description || error);
    }
    if (error) {
      return reject("OAUTH_ERROR", description || errorCode || error);
    }
    const code = parsed.searchParams.get("code") || parsed.searchParams.get("auth_code") || "";
    const state = parsed.searchParams.get("state") || "";
    return ok({ code, state });
  }
  const code = isNonEmptyString(input.code) ? input.code.trim() : "";
  const state = isNonEmptyString(input.state) ? input.state.trim() : "";
  if (isNonEmptyString(input.error)) {
    if (input.error === "access_denied") {
      return reject("OAUTH_DENIED", input.error);
    }
    return reject("OAUTH_ERROR", input.error);
  }
  return ok({ code, state });
}

async function exchangeCode(ctx, code, verifier) {
  if (!ctx.fetchImpl) {
    return reject("TOKEN_EXCHANGE", "fetch is not available");
  }
  const tokenUrl = `${ctx.config.supabaseUrl}/auth/v1/token?grant_type=pkce`;
  let response;
  try {
    response = await ctx.fetchImpl(tokenUrl, {
      method: "POST",
      headers: {
        apikey: ctx.config.supabaseAnonKey,
        Authorization: `Bearer ${ctx.config.supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: verifier,
      }),
    });
  } catch (err) {
    return reject("TOKEN_EXCHANGE", err && err.message ? err.message : String(err));
  }
  if (!response || response.ok === false) {
    const status = response && response.status ? String(response.status) : "network";
    return reject("TOKEN_EXCHANGE", status);
  }
  let body;
  try {
    body = typeof response.json === "function" ? await response.json() : response.body;
  } catch (err) {
    return reject("TOKEN_PARSE", err && err.message ? err.message : String(err));
  }
  return sessionFromToken(body, ctx.now());
}

function adoptRecord(ctx, record) {
  ctx.memory.session = record.session;
  ctx.memory.ticket = record.ticket;
}

function startOAuth(ctx, input) {
  if (ctx.blocked) {
    return ctx.blocked;
  }
  if (!ctx.config.hasAnonKey) {
    return reject("MISSING_ANON_KEY", "SUPABASE_ANON_KEY");
  }
  const redirectBase =
    input && isNonEmptyString(input.redirectTo) ? input.redirectTo.trim() : ctx.redirectTo;
  let redirectUrl;
  try {
    redirectUrl = new URL(redirectBase);
  } catch (err) {
    return reject("BAD_ARGUMENT", err && err.message ? err.message : "invalid redirectTo");
  }
  const state = randomState();
  const pkce = createPkce();
  const redirectTo = callbackRedirectTo(redirectUrl.toString(), state);
  const pending = {
    schema: SCHEMA,
    provider: PROVIDER,
    state,
    verifier: pkce.verifier,
    challenge: pkce.challenge,
    redirectTo,
    createdAt: asIso(ctx.now()),
  };
  savePending(ctx.home, pending);
  return ok({
    url: authorizeUrl(ctx.config, pending),
    state,
    redirectTo,
    supabaseCallback: PUBLIC.SUPABASE_CALLBACK,
  });
}

async function handleCallback(ctx, input) {
  if (ctx.blocked) {
    return ctx.blocked;
  }
  if (!ctx.config.hasAnonKey) {
    return reject("MISSING_ANON_KEY", "SUPABASE_ANON_KEY");
  }
  const parsed = parseCallbackInput(input);
  if (!parsed.ok) {
    return parsed;
  }
  if (!parsed.data.code) {
    return reject("BAD_ARGUMENT", "callback code missing");
  }
  if (!parsed.data.state) {
    return reject("BAD_ARGUMENT", "callback state missing");
  }
  const loaded = loadPending(ctx.home);
  if (!loaded.ok) {
    return loaded;
  }
  if (!loaded.data) {
    return reject("NO_PENDING", "");
  }
  const pending = loaded.data;
  const createdAt = Date.parse(pending.createdAt);
  if (!Number.isFinite(createdAt) || ctx.now() - createdAt > PENDING_TTL_MS) {
    clearPending(ctx.home);
    return reject("PENDING_EXPIRED", pending.createdAt || "");
  }
  if (pending.state !== parsed.data.state) {
    return reject("STATE_MISMATCH", parsed.data.state);
  }
  const exchanged = await exchangeCode(ctx, parsed.data.code, pending.verifier);
  if (!exchanged.ok) {
    return exchanged;
  }
  const record = {
    schema: SCHEMA,
    session: exchanged.data.session,
    ticket: exchanged.data.ticket,
    savedAt: asIso(ctx.now()),
  };
  saveSession(ctx.home, record);
  clearPending(ctx.home);
  adoptRecord(ctx, record);
  return ok(publicSession(record.session));
}

function currentSession(ctx) {
  if (ctx.blocked) {
    return ctx.blocked;
  }
  if (ctx.memory.session) {
    if (isExpired(ctx.memory.session, ctx.now())) {
      return reject("SESSION_EXPIRED", ctx.memory.session.expires);
    }
    return ok(publicSession(ctx.memory.session));
  }
  const loaded = loadSession(ctx.home);
  if (!loaded.ok) {
    return loaded;
  }
  if (!loaded.data) {
    return ok(null);
  }
  if (!isObject(loaded.data.session) || !isObject(loaded.data.ticket)) {
    return reject("STORE_CORRUPT", "session record missing session or ticket");
  }
  adoptRecord(ctx, loaded.data);
  if (isExpired(loaded.data.session, ctx.now())) {
    return reject("SESSION_EXPIRED", loaded.data.session.expires);
  }
  return ok(publicSession(loaded.data.session));
}

function signOut(ctx) {
  if (ctx.blocked) {
    return ctx.blocked;
  }
  ctx.memory.session = null;
  ctx.memory.ticket = null;
  clearAll(ctx.home);
  return ok({ signedOut: true });
}

function createAuth(opts) {
  const ctx = bind(opts);
  return {
    startOAuth(input) {
      return startOAuth(ctx, input);
    },
    handleCallback(input) {
      return handleCallback(ctx, input);
    },
    session() {
      return currentSession(ctx);
    },
    signOut() {
      return signOut(ctx);
    },
  };
}

module.exports = {
  createAuth,
  authorizeUrl,
  parseCallbackInput,
  DEFAULT_REDIRECT,
};
