"use strict";

const { ok, reject, isObject } = require("./result");
const { parseGithubRemote, publicRemoteUrl, stripUserinfo } = require("./remote");

const API_ROOT = "https://api.github.com";
const USER_AGENT = "rd-os-studio-chat-engine";

function isResourceExhausted(status, body) {
  if (status === 429) {
    return true;
  }
  const err = body && typeof body === "object" ? body.error || body : null;
  const message = err && typeof err.message === "string" ? err.message : typeof body === "string" ? body : "";
  return /resourceexhausted|rate[_ ]limit|insufficient[_ ]quota/i.test(message);
}

function createGithubReader(options) {
  const opts = options || {};
  if (opts.readPrForBranch || opts.readChecks || opts.readReviews) {
    return {
      mode: "inject",
      parseRemote: parseGithubRemote,
      readPrForBranch: opts.readPrForBranch || (async () => ok(null)),
      readChecks: opts.readChecks || (async () => ok(null)),
      readReviews: opts.readReviews || (async () => ok(null)),
    };
  }

  const fetchImpl = opts.fetch || globalThis.fetch;
  const env = opts.env || process.env;
  const token = env && env.GITHUB_TOKEN ? String(env.GITHUB_TOKEN).trim() : "";

  async function request(url) {
    if (typeof fetchImpl !== "function") {
      return { ok: true, data: null, mode: "stub", reason: "fetch_unavailable" };
    }
    if (!token) {
      return { ok: true, data: null, mode: "stub", reason: "github_read_needs_token" };
    }
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
    };
    let response;
    try {
      response = await fetchImpl(url, { headers });
    } catch (err) {
      return reject("GIT_EXEC", err && err.message ? err.message : String(err));
    }
    let body = null;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch (_err) {
      body = null;
    }
    if (isResourceExhausted(response.status, body)) {
      return reject("GIT_EXEC", "GitHub resource exhausted — STOP, no retry", { stop: true });
    }
    if (!response.ok) {
      return { ok: true, data: null, mode: "live", reason: `github_http_${response.status}` };
    }
    return { ok: true, data: body, mode: "live" };
  }

  async function readPrForBranch(query) {
    const owner = query && query.owner;
    const repo = query && query.repo;
    const branch = query && query.branch;
    if (!owner || !repo || !branch) {
      return ok(null);
    }
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?head=${encodeURIComponent(owner)}:${encodeURIComponent(branch)}&state=open&per_page=1`;
    const ran = await request(url);
    if (!ran.ok) {
      return ran;
    }
    if (!Array.isArray(ran.data) || ran.data.length === 0) {
      return { ok: true, data: null, mode: ran.mode || "stub" };
    }
    const raw = ran.data[0];
    return {
      ok: true,
      mode: "live",
      data: {
        number: raw.number,
        title: raw.title || "",
        state: raw.state || "open",
        draft: Boolean(raw.draft),
        html_url: raw.html_url || "",
        updated_at: raw.updated_at || null,
        head: raw.head && raw.head.sha ? raw.head.sha : null,
      },
    };
  }

  async function readChecks(query) {
    const owner = query && query.owner;
    const repo = query && query.repo;
    const ref = query && (query.sha || query.ref);
    if (!owner || !repo || !ref) {
      return ok(null);
    }
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}/check-runs`;
    const ran = await request(url);
    if (!ran.ok) {
      return ran;
    }
    if (!isObject(ran.data) || !Array.isArray(ran.data.check_runs)) {
      return { ok: true, data: null, mode: ran.mode || "stub" };
    }
    const runs = ran.data.check_runs.map((row) => ({
      name: row.name,
      status: row.status,
      conclusion: row.conclusion,
    }));
    const failing = runs.filter((row) => row.conclusion === "failure").map((row) => row.name);
    return {
      ok: true,
      mode: ran.mode || "live",
      data: {
        conclusion: failing.length > 0 ? "failure" : ran.data.check_runs.some((row) => row.conclusion === "success") ? "success" : "unknown",
        failing,
        runs,
      },
    };
  }

  async function readReviews(query) {
    const owner = query && query.owner;
    const repo = query && query.repo;
    const number = query && query.number;
    if (!owner || !repo || !number) {
      return ok(null);
    }
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${encodeURIComponent(String(number))}/comments`;
    const ran = await request(url);
    if (!ran.ok) {
      return ran;
    }
    if (!Array.isArray(ran.data)) {
      return { ok: true, data: null, mode: ran.mode || "stub" };
    }
    return {
      ok: true,
      mode: ran.mode || "live",
      data: {
        threads: ran.data.map((row) => ({
          id: row.id,
          path: row.path || "",
          body: row.body || "",
        })),
      },
    };
  }

  return {
    mode: token ? "live" : "stub",
    parseRemote: parseGithubRemote,
    readPrForBranch,
    readChecks,
    readReviews,
  };
}

module.exports = {
  parseGithubRemote,
  publicRemoteUrl,
  stripUserinfo,
  createGithubReader,
};
