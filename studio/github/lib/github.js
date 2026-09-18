"use strict";

const { reject, ok, isResourceExhausted } = require("./errors");

const API_ROOT = "https://api.github.com";
const USER_AGENT = "rd-os-studio-github";

function parseRepo(spec) {
  const raw = String(spec || "").trim();
  const match = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    return null;
  }
  return { owner: match[1], name: match[2], full_name: `${match[1]}/${match[2]}` };
}

function mapRepo(raw) {
  const owner = raw.owner && raw.owner.login ? raw.owner.login : String(raw.full_name || "").split("/")[0];
  return {
    owner,
    name: raw.name,
    full_name: raw.full_name || `${owner}/${raw.name}`,
    description: raw.description || "",
    default_branch: raw.default_branch || "main",
    html_url: raw.html_url || "",
    stargazers: raw.stargazers_count || 0,
    forks: raw.forks_count || 0,
    private: Boolean(raw.private),
    about: [],
  };
}

function mapEntry(raw) {
  return {
    name: raw.name,
    path: raw.path,
    type: raw.type === "dir" ? "dir" : "file",
    size: raw.size || 0,
    sha: raw.sha || "",
    message: "",
    updated_at: null,
  };
}

function mapPull(raw) {
  let state = raw.state === "closed" ? "closed" : "open";
  if (raw.merged_at) {
    state = "merged";
  }
  return {
    number: raw.number,
    title: raw.title,
    state,
    draft: Boolean(raw.draft),
    author: raw.user && raw.user.login ? raw.user.login : "",
    updated_at: raw.updated_at || null,
    html_url: raw.html_url || "",
  };
}

function decodeBlob(raw) {
  let content = raw.content || "";
  if (raw.encoding === "base64") {
    content = Buffer.from(String(content).replace(/\n/g, ""), "base64").toString("utf8");
  }
  const binary = content.includes("\u0000");
  return {
    path: raw.path,
    name: raw.name,
    encoding: binary ? "binary" : "utf-8",
    content: binary ? "" : content,
    size: raw.size || content.length,
    sha: raw.sha || "",
  };
}

function createGithubClient(options) {
  const fetchImpl = options && options.fetch ? options.fetch : globalThis.fetch;
  const env = options && options.env ? options.env : process.env;

  async function request(url) {
    const token = env.GITHUB_TOKEN ? String(env.GITHUB_TOKEN).trim() : "";
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const started = Date.now();
    let response;
    try {
      // One request. ResourceExhausted ⇒ STOP. Do not retry.
      response = await fetchImpl(url, { headers });
    } catch (err) {
      return reject("NETWORK_ERROR", err && err.message ? err.message : String(err), {
        wall_ms: Date.now() - started,
      });
    }
    const wallMs = Date.now() - started;
    const rawText = typeof response.text === "function" ? await response.text() : "";
    let body = null;
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch (_err) {
        body = { error: { message: rawText.slice(0, 300) } };
      }
    }
    if (isResourceExhausted(response.status, body)) {
      const detail =
        (body && body.message) ||
        (body && body.error && body.error.message) ||
        `GitHub ResourceExhausted HTTP ${response.status}`;
      return reject("RESOURCE_EXHAUSTED", `${detail} — STOP, no retry`, { wall_ms: wallMs });
    }
    if (!response.ok) {
      const detail = (body && body.message) || `GitHub HTTP ${response.status}`;
      return reject("GITHUB_HTTP", detail, { wall_ms: wallMs });
    }
    return ok(body);
  }

  function repoUrl(spec, suffix) {
    const parsed = parseRepo(spec || env.GITHUB_REPO || "nyfeblade/rd-os");
    if (!parsed) {
      return null;
    }
    const base = `${API_ROOT}/repos/${parsed.owner}/${parsed.name}`;
    return suffix ? `${base}${suffix}` : base;
  }

  async function repo(spec) {
    const url = repoUrl(spec, "");
    if (!url) {
      return reject("MISSING_REPO", "GITHUB_REPO must be owner/name");
    }
    const result = await request(url);
    if (!result.ok) {
      return result;
    }
    return ok(mapRepo(result.data));
  }

  async function tree(dirPath, spec) {
    const clean = String(dirPath || "").replace(/^\/+|\/+$/g, "");
    const suffix = clean ? `/contents/${clean.split("/").map(encodeURIComponent).join("/")}` : "/contents";
    const url = repoUrl(spec, suffix);
    if (!url) {
      return reject("MISSING_REPO", "GITHUB_REPO must be owner/name");
    }
    const result = await request(url);
    if (!result.ok) {
      return result;
    }
    if (!Array.isArray(result.data)) {
      return reject("UNKNOWN_PATH", `${clean || "/"} is not a directory`);
    }
    return ok(result.data.map(mapEntry));
  }

  async function blob(filePath, spec) {
    const clean = String(filePath || "").replace(/^\/+/, "");
    if (!clean) {
      return reject("UNKNOWN_PATH", "file path required");
    }
    const suffix = `/contents/${clean.split("/").map(encodeURIComponent).join("/")}`;
    const url = repoUrl(spec, suffix);
    if (!url) {
      return reject("MISSING_REPO", "GITHUB_REPO must be owner/name");
    }
    const result = await request(url);
    if (!result.ok) {
      return result;
    }
    if (Array.isArray(result.data) || result.data.type === "dir") {
      return reject("UNKNOWN_PATH", `${clean} is a directory`);
    }
    return ok(decodeBlob(result.data));
  }

  async function pulls(spec) {
    const url = repoUrl(spec, "/pulls?state=all&per_page=20&sort=updated");
    if (!url) {
      return reject("MISSING_REPO", "GITHUB_REPO must be owner/name");
    }
    const result = await request(url);
    if (!result.ok) {
      return result;
    }
    if (!Array.isArray(result.data)) {
      return reject("GITHUB_HTTP", "pulls response was not a list");
    }
    return ok(result.data.map(mapPull));
  }

  return {
    parseRepo,
    repo,
    tree,
    blob,
    pulls,
  };
}

module.exports = {
  API_ROOT,
  parseRepo,
  createGithubClient,
};
