"use strict";

const { reject, ok, assertNeverConnector, assertNeverSource } = require("./errors");
const { listConnectors, loadRecipe, isConnectorId, describeKnown, surfaceHooks } = require("./connectors");
const { parseRepo, createGithubClient } = require("./github");
const { createStore } = require("./store");
const { createFixtureBrowse, sortEntries } = require("./fixtures");
const { createRdosClient } = require("./rdos-client");
const { codePaneContract, drawCodePane, hideCodePane } = require("./pane");
const { homebaseContract } = require("./homebase");

function resolveSource(raw) {
  const value = String(raw || "fixture").trim().toLowerCase();
  if (value === "fixture" || value === "github") {
    return value;
  }
  return null;
}

function createStudio(options) {
  const opts = options || {};
  const store = createStore(opts.home);
  const persisted = store.read();
  let source = resolveSource(opts.source || process.env.STUDIO_SOURCE || persisted.source) || "fixture";
  const githubEnv = Object.assign({}, process.env, opts.env || {});
  if (persisted.github.repo && !githubEnv.GITHUB_REPO) {
    githubEnv.GITHUB_REPO = persisted.github.repo;
  }
  if (persisted.github.token && !githubEnv.GITHUB_TOKEN) {
    githubEnv.GITHUB_TOKEN = persisted.github.token;
  }
  const github = createGithubClient({
    fetch: opts.fetch || globalThis.fetch,
    env: githubEnv,
  });
  const fixtures = createFixtureBrowse();
  const rdos = createRdosClient({
    labRoot: opts.labRoot,
    spawnSync: opts.spawnSync,
  });

  function browse() {
    switch (source) {
      case "fixture":
        return fixtures;
      case "github":
        return github;
      default:
        return assertNeverSource(source);
    }
  }

  async function state() {
    const repoResult = await browse().repo(githubEnv.GITHUB_REPO);
    if (!repoResult.ok) {
      return repoResult;
    }
    return ok({
      studio: "C",
      fence: "studio/github",
      pane: codePaneContract(),
      homebase: homebaseContract(),
      source,
      repo: repoResult.data,
      connectors: listConnectors(),
      attach: store.publicState(),
      surface: surfaceHooks(),
      clock_started: false,
      verdict: null,
    });
  }

  async function tree(dirPath) {
    const result = await browse().tree(dirPath, githubEnv.GITHUB_REPO);
    if (!result.ok) {
      return result;
    }
    return ok(sortEntries(result.data));
  }

  function blob(filePath) {
    return browse().blob(filePath, githubEnv.GITHUB_REPO);
  }

  function pulls() {
    return browse().pulls(githubEnv.GITHUB_REPO);
  }

  function connectors() {
    const attached = new Set(store.publicState().attached);
    return ok(
      listConnectors().map((item) =>
        Object.assign({}, item, { attached: attached.has(item.id) })
      )
    );
  }

  function recipe(id) {
    return loadRecipe(id);
  }

  function setSource(next) {
    const resolved = resolveSource(next);
    if (!resolved) {
      return reject("UNKNOWN_SOURCE", "STUDIO_SOURCE must be fixture or github");
    }
    source = resolved;
    store.write({ source });
    return ok({ source });
  }

  function attach(id, payload) {
    const body = payload && typeof payload === "object" ? payload : {};
    if (!isConnectorId(id)) {
      return reject("UNKNOWN_CONNECTOR", `unknown connector ${id}`);
    }
    const known = describeKnown(id);
    switch (known.id) {
      case "github": {
        const repo = parseRepo(body.repo || githubEnv.GITHUB_REPO || "nyfeblade/rd-os");
        if (!repo) {
          return reject("MISSING_REPO", "attach GitHub with owner/name");
        }
        githubEnv.GITHUB_REPO = repo.full_name;
        if (typeof body.token === "string" && body.token.trim()) {
          githubEnv.GITHUB_TOKEN = body.token.trim();
        }
        const attached = store.read().attached.filter((item) => item !== "github");
        attached.push("github");
        store.write({
          source: body.source === "fixture" ? "fixture" : "github",
          github: {
            repo: repo.full_name,
            token: typeof body.token === "string" ? body.token.trim() : undefined,
          },
          attached,
        });
        source = store.read().source;
        return ok({
          id: "github",
          attached: true,
          repo: repo.full_name,
          recipe: loadRecipe("github").data,
        });
      }
      case "grok":
      case "claude":
      case "cursor":
        return reject("STUB_CONNECTOR", `${known.label} is a stub — later wire via studio/seats`);
      default:
        return assertNeverConnector(known.id);
    }
  }

  function pane() {
    return ok(codePaneContract());
  }

  function homebase() {
    return ok(homebaseContract());
  }

  function drawPane() {
    return drawCodePane();
  }

  function hidePane() {
    return hideCodePane();
  }

  function surface() {
    return ok(surfaceHooks());
  }

  function rdosHint() {
    return rdos.dumpAttention();
  }

  return {
    store,
    state,
    tree,
    blob,
    pulls,
    connectors,
    recipe,
    setSource,
    attach,
    pane,
    homebase,
    drawPane,
    hidePane,
    surface,
    rdosHint,
  };
}

module.exports = {
  resolveSource,
  createStudio,
};
