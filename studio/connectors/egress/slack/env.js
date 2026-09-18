"use strict";

/**
 * Env gate. Never invent tokens. Never read a fixture secret as live.
 * Live HTTP requires SLACK_BOT_TOKEN. Live DM helper also needs SLACK_DM_USER_ID.
 */

const { isBlank } = require("./contract");

const TOKEN_NAME = "SLACK_BOT_TOKEN";
const DM_USER_NAME = "SLACK_DM_USER_ID";

function readName(source, name) {
  const raw = source && source[name];
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function envOf(source) {
  const env = source || {};
  const token = readName(env, TOKEN_NAME);
  const dmUser = readName(env, DM_USER_NAME);
  return {
    token: isBlank(token) ? "" : token,
    dm_user_id: isBlank(dmUser) ? "" : dmUser,
    has_token: !isBlank(token),
    has_dm_user: !isBlank(dmUser),
    names: { token: TOKEN_NAME, dm_user: DM_USER_NAME },
  };
}

function processEnv() {
  return envOf(process.env);
}

function liveReady(auth) {
  return Boolean(auth && auth.has_token);
}

function liveDmReady(auth) {
  return Boolean(auth && auth.has_token && auth.has_dm_user);
}

module.exports = {
  TOKEN_NAME,
  DM_USER_NAME,
  envOf,
  processEnv,
  liveReady,
  liveDmReady,
};
