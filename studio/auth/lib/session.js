"use strict";

const { ok, reject, isObject, isNonEmptyString } = require("./result");
const { PROVIDER } = require("./codes");

function asIso(ms) {
  return new Date(ms).toISOString();
}

function identityFrom(user) {
  if (!isObject(user)) {
    return reject("USER_PARSE", "user object missing");
  }
  const meta = isObject(user.user_metadata) ? user.user_metadata : {};
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const github = identities.find((row) => isObject(row) && row.provider === "github");
  const githubData = github && isObject(github.identity_data) ? github.identity_data : {};
  const login =
    (isNonEmptyString(meta.user_name) && meta.user_name.trim()) ||
    (isNonEmptyString(meta.preferred_username) && meta.preferred_username.trim()) ||
    (isNonEmptyString(githubData.user_name) && githubData.user_name.trim()) ||
    "";
  if (!login) {
    return reject("USER_PARSE", "GitHub login missing");
  }
  const app = isObject(user.app_metadata) ? user.app_metadata : {};
  const provider = app.provider || (github && github.provider) || "";
  if (provider && provider !== PROVIDER) {
    return reject("WRONG_PROVIDER", String(provider));
  }
  if (!isNonEmptyString(user.id)) {
    return reject("USER_PARSE", "supabase user id missing");
  }
  const name = isNonEmptyString(meta.full_name) ? meta.full_name.trim() : null;
  const avatarUrl = isNonEmptyString(meta.avatar_url) ? meta.avatar_url.trim() : null;
  return ok({
    id: String(user.id),
    login,
    name,
    avatarUrl,
  });
}

function sessionFromToken(token, nowMs) {
  if (!isObject(token)) {
    return reject("TOKEN_PARSE", "token body is not an object");
  }
  if (!isNonEmptyString(token.access_token) || !isNonEmptyString(token.refresh_token)) {
    return reject("TOKEN_PARSE", "access_token or refresh_token missing");
  }
  const expiresIn = Number(token.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return reject("TOKEN_PARSE", "expires_in missing");
  }
  const user = identityFrom(token.user);
  if (!user.ok) {
    return user;
  }
  const expires = asIso(nowMs + expiresIn * 1000);
  return ok({
    session: {
      user: user.data,
      provider: PROVIDER,
      expires,
    },
    ticket: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: isNonEmptyString(token.token_type) ? token.token_type : "bearer",
    },
  });
}

function publicSession(session) {
  return {
    user: {
      id: session.user.id,
      login: session.user.login,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    provider: session.provider,
    expires: session.expires,
  };
}

function isExpired(session, nowMs) {
  const at = Date.parse(session.expires);
  if (!Number.isFinite(at)) {
    return true;
  }
  return at <= nowMs;
}

module.exports = {
  asIso,
  identityFrom,
  sessionFromToken,
  publicSession,
  isExpired,
};
