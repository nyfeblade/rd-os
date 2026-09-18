"use strict";

const { assertNever } = require("./result");

const SCHEMA = "studio.auth/v1";
const FENCE = "studio/auth";
const PRODUCT_LOCK = "github_oauth_via_supabase_mac";
const PROVIDER = "github";
const PENDING_TTL_MS = 10 * 60 * 1000;

const PUBLIC = Object.freeze({
  GITHUB_CLIENT_ID: "Ov23li0XxVscnZ92pG17",
  SUPABASE_PROJECT_REF: "ahuvocemlpqmbcvqlxve",
  SUPABASE_URL: "https://ahuvocemlpqmbcvqlxve.supabase.co",
  SUPABASE_CALLBACK: "https://ahuvocemlpqmbcvqlxve.supabase.co/auth/v1/callback",
});

const REJECT_CODES = Object.freeze([
  "PLATFORM_UNSUPPORTED",
  "UNKNOWN_GITHUB_CLIENT",
  "UNKNOWN_SUPABASE_URL",
  "MISSING_ANON_KEY",
  "BAD_ARGUMENT",
  "NO_PENDING",
  "PENDING_EXPIRED",
  "STATE_MISMATCH",
  "OAUTH_DENIED",
  "OAUTH_ERROR",
  "IMPLICIT_FLOW",
  "TOKEN_EXCHANGE",
  "TOKEN_PARSE",
  "USER_PARSE",
  "WRONG_PROVIDER",
  "SESSION_EXPIRED",
  "STORE_CORRUPT",
]);

function describeReject(code) {
  switch (code) {
    case "PLATFORM_UNSUPPORTED":
      return "studio/auth is Mac-only; Windows is out of this fence";
    case "UNKNOWN_GITHUB_CLIENT":
      return "GITHUB_CLIENT_ID must be the public Studio OAuth app Ov23li0XxVscnZ92pG17";
    case "UNKNOWN_SUPABASE_URL":
      return "SUPABASE_URL must be https://ahuvocemlpqmbcvqlxve.supabase.co";
    case "MISSING_ANON_KEY":
      return "SUPABASE_ANON_KEY is empty; secret-request it and put it in .env";
    case "BAD_ARGUMENT":
      return "required argument missing or malformed";
    case "NO_PENDING":
      return "no startOAuth pending on this Mac; start again";
    case "PENDING_EXPIRED":
      return "the OAuth pending expired; startOAuth again";
    case "STATE_MISMATCH":
      return "callback state does not match the pending startOAuth";
    case "OAUTH_DENIED":
      return "the human denied GitHub access";
    case "OAUTH_ERROR":
      return "GitHub or Supabase returned an OAuth error";
    case "IMPLICIT_FLOW":
      return "implicit token in the URL hash is rejected; PKCE only";
    case "TOKEN_EXCHANGE":
      return "Supabase token exchange failed";
    case "TOKEN_PARSE":
      return "Supabase token JSON was missing required fields";
    case "USER_PARSE":
      return "Supabase user JSON had no GitHub login";
    case "WRONG_PROVIDER":
      return "session provider must be github";
    case "SESSION_EXPIRED":
      return "the stored session is past expires; startOAuth again";
    case "STORE_CORRUPT":
      return "the Mac session file could not be read";
    default:
      return assertNever(code, "RejectCode");
  }
}

module.exports = {
  SCHEMA,
  FENCE,
  PRODUCT_LOCK,
  PROVIDER,
  PENDING_TTL_MS,
  PUBLIC,
  REJECT_CODES,
  describeReject,
};
