"use strict";

function stripUserinfo(url) {
  return String(url || "").replace(/^(https?:\/\/)[^/@]+@/i, "$1");
}

function parseGithubRemote(url) {
  const raw = stripUserinfo(String(url || "").trim());
  if (!raw) {
    return null;
  }
  const stripped = raw.replace(/\.git$/i, "");
  const ssh = stripped.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) {
    return { owner: ssh[1], repo: ssh[2], full_name: `${ssh[1]}/${ssh[2]}` };
  }
  const sshUrl = stripped.match(/^ssh:\/\/(?:git@)?github\.com\/([^/]+)\/([^/]+)$/i);
  if (sshUrl) {
    return { owner: sshUrl[1], repo: sshUrl[2], full_name: `${sshUrl[1]}/${sshUrl[2]}` };
  }
  const https = stripped.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)$/i);
  if (https) {
    return { owner: https[1], repo: https[2], full_name: `${https[1]}/${https[2]}` };
  }
  return null;
}

function publicRemoteUrl(url) {
  if (!url) {
    return null;
  }
  const parsed = parseGithubRemote(url);
  if (parsed) {
    return `https://github.com/${parsed.full_name}.git`;
  }
  const redacted = stripUserinfo(String(url).trim());
  return redacted || null;
}

module.exports = {
  stripUserinfo,
  parseGithubRemote,
  publicRemoteUrl,
};
