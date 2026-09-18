"use strict";

function envTokenProvider(env) {
  const source = env && typeof env === "object" ? env : {};
  return function getToken() {
    const raw = source.GITHUB_TOKEN;
    return typeof raw === "string" ? raw.trim() : "";
  };
}

async function readToken(provider) {
  if (typeof provider !== "function") {
    return "";
  }
  try {
    const value = await provider();
    return typeof value === "string" ? value.trim() : "";
  } catch (_err) {
    return "";
  }
}

module.exports = {
  envTokenProvider,
  readToken,
};
