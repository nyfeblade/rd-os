"use strict";

const fs = require("fs");
const path = require("path");

function createStore(home) {
  const root = home || path.join(process.cwd(), "var");
  const file = path.join(root, "connectors.json");

  function ensure() {
    fs.mkdirSync(root, { recursive: true });
  }

  function read() {
    if (!fs.existsSync(file)) {
      return { source: "fixture", github: { repo: "nyfeblade/rd-os" }, attached: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return {
        source: raw.source === "github" ? "github" : "fixture",
        github: {
          repo: (raw.github && raw.github.repo) || "nyfeblade/rd-os",
          has_token: Boolean(raw.github && raw.github.token),
          token: raw.github && raw.github.token ? String(raw.github.token) : "",
        },
        attached: Array.isArray(raw.attached) ? raw.attached : [],
      };
    } catch (_err) {
      return { source: "fixture", github: { repo: "nyfeblade/rd-os" }, attached: [] };
    }
  }

  function write(next) {
    ensure();
    const current = read();
    const merged = {
      source: next.source || current.source,
      github: {
        repo: (next.github && next.github.repo) || current.github.repo,
        token: next.github && Object.prototype.hasOwnProperty.call(next.github, "token")
          ? next.github.token
          : current.github.token,
      },
      attached: next.attached || current.attached,
    };
    fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`);
    return read();
  }

  function publicState() {
    const state = read();
    return {
      source: state.source,
      github: { repo: state.github.repo, has_token: Boolean(state.github.token) },
      attached: state.attached,
    };
  }

  return { root, file, read, write, publicState };
}

module.exports = { createStore };
