#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { createGithubClient } = require("../lib/github");
const { createStudio } = require("../lib/studio");
const { createStudioServer } = require("../lib/http");
const { listConnectors, loadRecipe, CONNECTOR_IDS } = require("../lib/connectors");
const { REJECT_CODES, describeReject } = require("../lib/errors");
const { CODE_PANE } = require("../lib/pane");
const { HOMEBASE } = require("../lib/homebase");

const ROOT = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write(`FAIL studio-github: ${message}\n`);
  process.exit(1);
}

function countingFetch(handler) {
  const state = { calls: 0, urls: [] };
  async function fetchImpl(url) {
    state.calls += 1;
    state.urls.push(String(url));
    return handler(url, state);
  }
  fetchImpl.state = state;
  return fetchImpl;
}

function mockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
        method,
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch (_err) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed, raw });
        });
      }
    );
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function main() {
  const started = Date.now();

  for (const file of [
    "README.md",
    "package.json",
    "recipes/github.json",
    "recipes/grok.json",
    "recipes/claude.json",
    "recipes/cursor.json",
    "ui/index.html",
    "ui/app.js",
    "ui/app.css",
    "bin/studio.js",
    "lib/studio.js",
    "lib/pane.js",
    "lib/homebase.js",
  ]) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      fail(`missing ${file}`);
    }
  }

  const catalog = listConnectors();
  if (catalog.length !== 4) {
    fail(`expected 4 connectors, got ${catalog.length}`);
  }
  const byId = Object.fromEntries(catalog.map((item) => [item.id, item]));
  if (byId.github.status !== "ready" || byId.github.kind !== "repo") {
    fail("github must be the ready repo connector");
  }
  for (const id of ["grok", "claude", "cursor"]) {
    if (byId[id].status !== "stub" || byId[id].kind !== "seat") {
      fail(`${id} must be a seat stub`);
    }
  }
  process.stdout.write("PASS connector scaffold github ready + grok/claude/cursor stubs\n");

  const recipe = loadRecipe("github");
  if (!recipe.ok || recipe.data.resource_exhausted !== "STOP, no retry") {
    fail("github recipe missing STOP, no retry");
  }
  if (!recipe.data.env || recipe.data.env.STUDIO_SOURCE !== "github") {
    fail("github recipe missing STUDIO_SOURCE");
  }
  process.stdout.write("PASS github attach recipe\n");

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "studio-github-"));
  const studio = createStudio({ home, source: "fixture" });
  const state = await studio.state();
  if (!state.ok || state.data.repo.full_name !== "nyfeblade/rd-os") {
    fail(`fixture state repo ${JSON.stringify(state)}`);
  }
  if (state.data.clock_started !== false || state.data.verdict !== null) {
    fail("studio must not start the 14d clock or self-cert");
  }
  if (!state.data.pane || state.data.pane.pane !== "code") {
    fail("state must declare Code pane contract");
  }
  if (state.data.pane.draw !== "on-demand" || state.data.pane.default_visible !== false) {
    fail("Code pane must draw on-demand, not as a default column");
  }
  if (state.data.pane.three_pane_always !== false) {
    fail("three-pane-always must be false");
  }
  if (state.data.pane.default_chrome.join(",") !== "chat,board") {
    fail("default chrome must be Chat + Board");
  }
  if (state.data.pane.surface !== "eng" || state.data.pane.theater !== false || state.data.pane.job !== "human+AI coding") {
    fail("pane must be an eng coding surface, not life-OS theater");
  }
  if (
    state.data.pane.homebase !== "any-ai-developer" ||
    state.data.pane.multi_provider !== true ||
    state.data.pane.cold_open !== true
  ) {
    fail("pane must be a multi-provider cold-open homebase for any AI developer");
  }
  if (!state.data.homebase || state.data.homebase.providers.join(",") !== "github,grok,claude,cursor") {
    fail("homebase providers must be github + grok + claude + cursor");
  }
  if (HOMEBASE.audience !== "any-ai-developer" || HOMEBASE.cold_open !== true) {
    fail("HOMEBASE drifted");
  }
  if (state.data.pane.does_not_own.indexOf("shell") < 0 || state.data.pane.does_not_own.indexOf("chat") < 0) {
    fail("Code pane must not own shell/chat chrome");
  }
  if (state.data.pane.does_not_own.indexOf("life-os") < 0) {
    fail("pane must reject life-OS theater");
  }
  const drawn = studio.drawPane();
  const hidden = studio.hidePane();
  if (!drawn.ok || drawn.data.visible !== true || hidden.data.visible !== false) {
    fail("draw/hide must toggle Code pane visibility");
  }
  if (CODE_PANE.pane !== "code" || CODE_PANE.draw !== "on-demand") {
    fail("CODE_PANE drifted");
  }
  const tree = await studio.tree("");
  if (!tree.ok || !tree.data.some((entry) => entry.name === "README.md")) {
    fail("fixture tree missing README.md");
  }
  if (!tree.data.some((entry) => entry.name === "studio" && entry.type === "dir")) {
    fail("fixture tree missing studio/");
  }
  const nested = await studio.tree("studio/github");
  if (!nested.ok || !nested.data.some((entry) => entry.name === "README.md")) {
    fail("fixture nested tree missing studio/github/README.md");
  }
  const blob = await studio.blob("README.md");
  if (!blob.ok || !String(blob.data.content).includes("rd-os")) {
    fail("fixture blob missing README");
  }
  const pulls = await studio.pulls();
  if (!pulls.ok || pulls.data.length < 2) {
    fail("fixture pulls missing");
  }
  process.stdout.write("PASS fixture repo browse (tree / blob / pulls)\n");

  const attached = studio.attach("github", { repo: "nyfeblade/rd-os", source: "fixture" });
  if (!attached.ok || attached.data.repo !== "nyfeblade/rd-os") {
    fail(`github attach failed ${JSON.stringify(attached)}`);
  }
  const stub = studio.attach("cursor", {});
  if (stub.ok || stub.code !== "STUB_CONNECTOR") {
    fail(`cursor stub should STUB_CONNECTOR, got ${JSON.stringify(stub)}`);
  }
  const unknown = studio.attach("max", {});
  if (unknown.ok || unknown.code !== "UNKNOWN_CONNECTOR") {
    fail(`unknown connector should reject, got ${JSON.stringify(unknown)}`);
  }
  process.stdout.write("PASS attach github + stub seats\n");

  const hooks = studio.surface();
  const hookIds = hooks.data.hooks.map((hook) => hook.id);
  if (!hookIds.includes("file-tree") || !hookIds.includes("pr-list") || !hookIds.includes("coding-surface")) {
    fail(`surface hooks missing ${JSON.stringify(hookIds)}`);
  }
  process.stdout.write("PASS human+AI surface hooks (file-tree / pr-list / coding-surface)\n");

  const exhausted429 = countingFetch(async () =>
    mockResponse(403, { message: "API rate limit exceeded", documentation_url: "https://docs.github.com" })
  );
  const live = createGithubClient({
    env: { GITHUB_REPO: "nyfeblade/rd-os" },
    fetch: exhausted429,
  });
  const exhausted = await live.repo("nyfeblade/rd-os");
  if (exhausted.ok || exhausted.code !== "RESOURCE_EXHAUSTED" || !exhausted.stop) {
    fail(`expected RESOURCE_EXHAUSTED stop, got ${JSON.stringify(exhausted)}`);
  }
  if (exhausted429.state.calls !== 1) {
    fail(`429 path retried: fetch_calls=${exhausted429.state.calls}`);
  }
  process.stdout.write("PASS RESOURCE_EXHAUSTED rate limit fetch_calls=1 (no retry)\n");

  const exhaustedQuota = countingFetch(async () =>
    mockResponse(429, { message: "You have exceeded a secondary rate limit" })
  );
  const quotaClient = createGithubClient({
    env: { GITHUB_REPO: "nyfeblade/rd-os" },
    fetch: exhaustedQuota,
  });
  const quota = await quotaClient.tree("", "nyfeblade/rd-os");
  if (quota.ok || quota.code !== "RESOURCE_EXHAUSTED" || exhaustedQuota.state.calls !== 1) {
    fail(`quota path retried or misclassified: ${JSON.stringify(quota)} calls=${exhaustedQuota.state.calls}`);
  }
  process.stdout.write("PASS RESOURCE_EXHAUSTED 429 fetch_calls=1 (no retry)\n");

  for (const code of REJECT_CODES) {
    if (!describeReject(code)) {
      fail(`describeReject missing ${code}`);
    }
  }

  const { server } = createStudioServer({ home, root: ROOT, source: "fixture" });
  const port = await listen(server);
  const html = await request(port, "GET", "/");
  if (html.status !== 200 || !String(html.raw).includes("data-pane=\"code\"")) {
    await close(server);
    fail("UI missing Code pane root");
  }
  if (!String(html.raw).includes("data-draw=\"on-demand\"") || !String(html.raw).includes("data-default-visible=\"false\"")) {
    await close(server);
    fail("UI must mark Code pane on-demand, not always-visible");
  }
  if (!String(html.raw).includes("data-nav=\"code\"") || !String(html.raw).includes("data-hook=\"file-tree\"")) {
    await close(server);
    fail("UI missing Code pane tree/nav");
  }
  const banned = [
    "AI Coding Studio",
    "aria-label=\"Chat\"",
    "aria-label=\"Board\"",
    "connectors ▾",
    "3 online",
    "in-studio-only",
    "life-OS theater",
    "Waiting home",
    "immersive",
  ];
  for (const token of banned) {
    if (String(html.raw).includes(token)) {
      await close(server);
      fail(`Code pane must not own shell chrome: ${token}`);
    }
  }
  const apiState = await request(port, "GET", "/api/state");
  if (apiState.status !== 200 || !apiState.body.ok || apiState.body.data.fence !== "studio/github") {
    await close(server);
    fail(`api/state ${JSON.stringify(apiState.body)}`);
  }
  const apiTree = await request(port, "GET", "/api/tree?path=");
  if (apiTree.status !== 200 || !apiTree.body.ok) {
    await close(server);
    fail("api/tree failed");
  }
  const apiPulls = await request(port, "GET", "/api/pulls");
  if (apiPulls.status !== 200 || !apiPulls.body.ok) {
    await close(server);
    fail("api/pulls failed");
  }
  const apiRecipe = await request(port, "GET", "/api/recipe/github");
  if (apiRecipe.status !== 200 || apiRecipe.body.data.connector !== "github") {
    await close(server);
    fail("api/recipe/github failed");
  }
  const apiSurface = await request(port, "GET", "/api/surface");
  if (apiSurface.status !== 200 || !apiSurface.body.data.hooks) {
    await close(server);
    fail("api/surface failed");
  }
  const apiHomebase = await request(port, "GET", "/api/homebase");
  if (
    apiHomebase.status !== 200 ||
    apiHomebase.body.data.audience !== "any-ai-developer" ||
    apiHomebase.body.data.multi_provider !== true
  ) {
    await close(server);
    fail(`api/homebase ${JSON.stringify(apiHomebase.body)}`);
  }
  const apiPane = await request(port, "GET", "/api/pane");
  if (apiPane.status !== 200 || apiPane.body.data.draw !== "on-demand" || apiPane.body.data.three_pane_always !== false) {
    await close(server);
    fail(`api/pane must be on-demand: ${JSON.stringify(apiPane.body)}`);
  }
  const apiHide = await request(port, "POST", "/api/pane/hide", {});
  if (!apiHide.body.ok || apiHide.body.data.visible !== false) {
    await close(server);
    fail("api/pane/hide must hide Code");
  }
  const apiDraw = await request(port, "POST", "/api/pane/draw", {});
  if (!apiDraw.body.ok || apiDraw.body.data.visible !== true) {
    await close(server);
    fail("api/pane/draw must draw Code on demand");
  }
  const spa = await request(port, "GET", "/pulls");
  if (spa.status !== 200 || !String(spa.raw).includes("data-pane=\"code\"")) {
    await close(server);
    fail("SPA /pulls did not serve the Code pane");
  }
  if (!apiState.body.data.pane || apiState.body.data.pane.pane !== "code") {
    await close(server);
    fail("api/state missing Code pane contract");
  }
  await close(server);
  process.stdout.write("PASS http browse + recipe + surface\n");

  if (CONNECTOR_IDS.join(",") !== "github,grok,claude,cursor") {
    fail("max connector order drifted");
  }

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  if (!readme.includes("cd rd-os/studio/github") || !readme.includes("npm test")) {
    fail("README missing stranger path");
  }
  if (!readme.includes("Code pane") || !readme.includes("does **not** own studio shell chrome")) {
    fail("README must say this is Code pane payload, not shell chrome");
  }
  if (!readme.includes("on demand") || !readme.includes("Three-pane-always is wrong")) {
    fail("README must lock Code as on-demand, not three-pane-always");
  }
  if (!readme.includes("eng surfaces") || !readme.includes("No life-OS theater")) {
    fail("README must state product law: eng surfaces, no life-OS theater");
  }
  if (!readme.includes("any AI developer") || !readme.includes("Multi-provider")) {
    fail("README must state north star: any AI developer homebase, multi-provider");
  }

  const wallMs = Date.now() - started;
  process.stdout.write(
    `PASS studio-github (browse + attach recipe + stubs + surface hooks; wall_ms=${wallMs}; not a 14d verdict)\n`
  );
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
