"use strict";

const { reject, ok, isResourceExhausted } = require("./errors");
const { envTokenProvider, readToken } = require("./token");

const API_ROOT = "https://api.github.com";
const USER_AGENT = "rd-os-studio-github";

function parseRepo(spec) {
  const raw = String(spec || "").trim();
  const match = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    return null;
  }
  const owner = match[1];
  const name = match[2];
  if (owner === "." || owner === ".." || name === "." || name === "..") {
    return null;
  }
  if (owner.includes("\\") || name.includes("\\")) {
    return null;
  }
  return { owner, name, full_name: `${owner}/${name}` };
}

function cleanPath(raw) {
  const text = String(raw || "").replace(/^\/+|\/+$/g, "");
  if (!text) {
    return "";
  }
  const parts = text.split("/");
  for (const part of parts) {
    if (!part || part === "." || part === "..") {
      return null;
    }
    if (part.includes("\\")) {
      return null;
    }
  }
  return parts.join("/");
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
  const tokenProvider =
    options && typeof options.tokenProvider === "function"
      ? options.tokenProvider
      : envTokenProvider(env);

  async function request(url, init) {
    const token = await readToken(tokenProvider);
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const method = init && init.method ? String(init.method).toUpperCase() : "GET";
    const fetchOpts = { method, headers };
    if (init && init.body != null) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    }
    const started = Date.now();
    let response;
    try {
      response = await fetchImpl(url, fetchOpts);
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
    const base = `${API_ROOT}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
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
    const clean = cleanPath(dirPath);
    if (clean === null) {
      return reject("UNKNOWN_PATH", "path is not on the browse tree");
    }
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
    const clean = cleanPath(filePath);
    if (clean === null || !clean) {
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

  async function post(url, body) {
    return request(url, { method: "POST", body });
  }

  return {
    parseRepo,
    repo,
    tree,
    blob,
    pulls,
    post,
  };
}

module.exports = {
  API_ROOT,
  parseRepo,
  cleanPath,
  createGithubClient,
};
