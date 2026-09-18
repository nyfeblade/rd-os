"use strict";

const { ok, reject, isNonEmptyString } = require("./result");
const { PUBLIC } = require("./codes");

function trimEnv(env, name) {
  const raw = env && env[name];
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function stripSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function parseConfig(env) {
  const source = env && typeof env === "object" ? env : {};
  const githubClientId = trimEnv(source, "GITHUB_CLIENT_ID") || PUBLIC.GITHUB_CLIENT_ID;
  if (githubClientId !== PUBLIC.GITHUB_CLIENT_ID) {
    return reject("UNKNOWN_GITHUB_CLIENT", githubClientId);
  }
  const supabaseUrl = stripSlash(trimEnv(source, "SUPABASE_URL") || PUBLIC.SUPABASE_URL);
  if (supabaseUrl !== PUBLIC.SUPABASE_URL) {
    return reject("UNKNOWN_SUPABASE_URL", supabaseUrl);
  }
  const supabaseAnonKey = trimEnv(source, "SUPABASE_ANON_KEY");
  return ok({
    githubClientId,
    supabaseUrl,
    supabaseAnonKey,
    supabaseCallback: PUBLIC.SUPABASE_CALLBACK,
    supabaseRef: PUBLIC.SUPABASE_PROJECT_REF,
    hasAnonKey: isNonEmptyString(supabaseAnonKey),
  });
}

module.exports = {
  parseConfig,
  trimEnv,
  stripSlash,
};
