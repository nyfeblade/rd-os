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
const { envTokenProvider } = require("../lib/token");
const { comment, reply, mapComment, mapReply } = require("../lib/egress");
const { mapNotification, ENVELOPE_FIELDS, IDENTITY_FIELDS } = require("../lib/notifications");

const ROOT = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write(`FAIL studio-github: ${message}\n`);
  process.exit(1);
}

function countingFetch(handler) {
  const state = { calls: 0, urls: [], inits: [] };
  async function fetchImpl(url, init) {
    state.calls += 1;
    state.urls.push(String(url));
    state.inits.push(init || {});
    return handler(url, state, init);
  }
  fetchImpl.state = state;
  return fetchImpl;
}

function bannedFetch() {
  return countingFetch(async () => {
    throw new Error("fetch was called without a live token gate");
  });
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
    "lib/token.js",
    "lib/egress.js",
    "lib/notifications.js",
    "INGEST.md",
    "fixtures/notifications.json",
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

  const secret = "ghp_not_a_real_token_fixture";
  const leakFetch = countingFetch(async () => mockResponse(404, { message: "Not Found" }));
  const leakClient = createGithubClient({
    env: { GITHUB_REPO: "nyfeblade/rd-os", GITHUB_TOKEN: secret },
    fetch: leakFetch,
  });
  const leaked = await leakClient.repo("nyfeblade/rd-os");
  if (leaked.ok) {
    fail("404 should reject");
  }
  if (JSON.stringify(leaked).includes(secret) || leakFetch.state.urls.join("").includes(secret)) {
    fail("token leaked in reject or url");
  }
  const authHeader = leakFetch.state.inits[0] && leakFetch.state.inits[0].headers
    ? leakFetch.state.inits[0].headers.Authorization
    : "";
  if (authHeader !== `Bearer ${secret}`) {
    fail(`tokenProvider did not inject Authorization, got ${authHeader}`);
  }
  process.stdout.write("PASS token provider inject (no token in errors)\n");

  const injected = countingFetch(async () =>
    mockResponse(200, {
      name: "rd-os",
      full_name: "nyfeblade/rd-os",
      owner: { login: "nyfeblade" },
      default_branch: "main",
    })
  );
  const injectClient = createGithubClient({
    env: { GITHUB_REPO: "nyfeblade/rd-os", GITHUB_TOKEN: "env-should-not-win" },
    tokenProvider: () => "injected-token",
    fetch: injected,
  });
  const injectedRepo = await injectClient.repo("nyfeblade/rd-os");
  if (!injectedRepo.ok || injectedRepo.data.full_name !== "nyfeblade/rd-os") {
    fail(`injected browse failed ${JSON.stringify(injectedRepo)}`);
  }
  if (injected.state.inits[0].headers.Authorization !== "Bearer injected-token") {
    fail("injected tokenProvider lost to env");
  }
  process.stdout.write("PASS tokenProvider wins over env\n");

  const traverseFetch = bannedFetch();
  const traverse = createGithubClient({
    env: { GITHUB_REPO: "nyfeblade/rd-os" },
    fetch: traverseFetch,
  });
  const badTree = await traverse.tree("../secret", "nyfeblade/rd-os");
  if (badTree.ok || badTree.code !== "UNKNOWN_PATH" || traverseFetch.state.calls !== 0) {
    fail(`path traversal reached network: ${JSON.stringify(badTree)} calls=${traverseFetch.state.calls}`);
  }
  const badRepo = traverse.parseRepo("nyfeblade/..");
  if (badRepo) {
    fail("parseRepo allowed ..");
  }
  const badBlob = await traverse.blob("foo/../../etc/passwd", "nyfeblade/rd-os");
  if (badBlob.ok || traverseFetch.state.calls !== 0) {
    fail("blob traversal reached network");
  }
  process.stdout.write("PASS browse rejects path traversal\n");

  const dryFetch = bannedFetch();
  const dry = await comment(
    { repo: "nyfeblade/rd-os", issue_number: 18, body: "looks right" },
    { live: false, fetch: dryFetch, tokenProvider: () => "should-not-send" }
  );
  if (!dry.ok || dry.data.dry !== true || dry.data.http !== null || dryFetch.state.calls !== 0) {
    fail(`dry comment hit network ${JSON.stringify(dry)} calls=${dryFetch.state.calls}`);
  }
  if (dry.data.op !== "create_issue_comment") {
    fail(`dry comment op ${dry.data.op}`);
  }
  if (dry.data.url !== "https://api.github.com/repos/nyfeblade/rd-os/issues/18/comments") {
    fail(`dry comment url ${dry.data.url}`);
  }
  if (dry.data.request.body !== "looks right") {
    fail(`dry comment body ${JSON.stringify(dry.data.request)}`);
  }
  process.stdout.write("PASS egress comment dry-run (no fetch)\n");

  const dryReply = await reply(
    { repo: "nyfeblade/rd-os", pull_number: 42, in_reply_to: 99, body: "thread reply" },
    { fetch: bannedFetch() }
  );
  if (!dryReply.ok || dryReply.data.dry !== true || dryReply.data.op !== "create_pull_request_review_comment") {
    fail(`dry reply ${JSON.stringify(dryReply)}`);
  }
  if (dryReply.data.url !== "https://api.github.com/repos/nyfeblade/rd-os/pulls/42/comments") {
    fail(`dry reply url ${dryReply.data.url}`);
  }
  if (dryReply.data.request.in_reply_to !== 99) {
    fail(`dry reply missing in_reply_to ${JSON.stringify(dryReply.data.request)}`);
  }
  process.stdout.write("PASS egress reply dry-run\n");

  const empty = mapComment({ repo: "nyfeblade/rd-os", issue_number: 1, body: "   " });
  if (empty.ok || empty.code !== "EMPTY_BODY") {
    fail(`empty body ${JSON.stringify(empty)}`);
  }
  const missing = mapReply({ issue_number: 1, body: "x" });
  if (missing.ok || missing.code !== "MISSING_REPO") {
    fail(`missing repo ${JSON.stringify(missing)}`);
  }
  process.stdout.write("PASS egress map rejects empty body and missing repo\n");

  const unauthFetch = bannedFetch();
  const unauth = await comment(
    { repo: "nyfeblade/rd-os", issue_number: 18, body: "live without token" },
    { live: true, fetch: unauthFetch, tokenProvider: () => "" }
  );
  if (unauth.ok || unauth.code !== "NEEDS_AUTH" || unauthFetch.state.calls !== 0) {
    fail(`live without token ${JSON.stringify(unauth)} calls=${unauthFetch.state.calls}`);
  }
  const noProvider = await reply(
    { repo: "nyfeblade/rd-os", issue_number: 18, body: "live without provider" },
    { live: true, fetch: unauthFetch }
  );
  if (noProvider.ok || noProvider.code !== "NEEDS_AUTH" || unauthFetch.state.calls !== 0) {
    fail(`live without provider called fetch ${JSON.stringify(noProvider)}`);
  }
  process.stdout.write("PASS egress live NEEDS_AUTH without token (no fetch)\n");

  const liveFetch = countingFetch(async () =>
    mockResponse(201, { id: 1, body: "posted", html_url: "https://github.com/nyfeblade/rd-os/issues/18#issuecomment-1" })
  );
  const liveComment = await comment(
    { owner: "nyfeblade", repo: "rd-os", issue_number: 18, body: "posted" },
    { live: true, fetch: liveFetch, tokenProvider: () => "live-token" }
  );
  if (!liveComment.ok || liveComment.data.dry !== false || liveComment.data.comment.body !== "posted") {
    fail(`live comment ${JSON.stringify(liveComment)}`);
  }
  if (liveFetch.state.calls !== 1) {
    fail(`live comment fetch_calls=${liveFetch.state.calls}`);
  }
  if (liveFetch.state.inits[0].method !== "POST") {
    fail(`live comment method ${liveFetch.state.inits[0].method}`);
  }
  if (liveFetch.state.inits[0].headers.Authorization !== "Bearer live-token") {
    fail("live comment missing injected Authorization");
  }
  if (liveFetch.state.inits[0].body !== JSON.stringify({ body: "posted" })) {
    fail(`live comment payload ${liveFetch.state.inits[0].body}`);
  }
  process.stdout.write("PASS egress live mock POST issue comment\n");

  const liveReplyFetch = countingFetch(async () => mockResponse(201, { id: 2, body: "replied" }));
  const liveReply = await reply(
    { repo: "nyfeblade/rd-os", pull_number: 42, in_reply_to: 7, body: "replied" },
    { live: true, fetch: liveReplyFetch, tokenProvider: envTokenProvider({ GITHUB_TOKEN: "env-live" }) }
  );
  if (!liveReply.ok || liveReply.data.comment.body !== "replied") {
    fail(`live reply ${JSON.stringify(liveReply)}`);
  }
  if (liveReplyFetch.state.urls[0] !== "https://api.github.com/repos/nyfeblade/rd-os/pulls/42/comments") {
    fail(`live reply url ${liveReplyFetch.state.urls[0]}`);
  }
  if (liveReplyFetch.state.inits[0].body !== JSON.stringify({ body: "replied", in_reply_to: 7 })) {
    fail(`live reply payload ${liveReplyFetch.state.inits[0].body}`);
  }
  if (liveReplyFetch.state.inits[0].headers.Authorization !== "Bearer env-live") {
    fail("envTokenProvider did not supply live reply token");
  }
  process.stdout.write("PASS egress live mock reply in_reply_to\n");

  const notes = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "notifications.json"), "utf8"));
  const mention = mapNotification(notes.mention, { has_token: true, actor_id: "nyfeblade" });
  if (!mention.ok) {
    fail(`mention map ${JSON.stringify(mention)}`);
  }
  const envelope = mention.data;
  if (Object.keys(envelope).sort().join(",") !== ENVELOPE_FIELDS.slice().sort().join(",")) {
    fail(`envelope keys ${Object.keys(envelope)}`);
  }
  if (Object.keys(envelope.identity).sort().join(",") !== IDENTITY_FIELDS.slice().sort().join(",")) {
    fail(`identity keys ${Object.keys(envelope.identity)}`);
  }
  if (envelope.provider !== "github" || envelope.event !== "issue_comment") {
    fail(`mention event ${envelope.provider} ${envelope.event}`);
  }
  if (envelope.received_at !== "2026-09-18T12:00:00Z" || envelope.at_you !== true) {
    fail(`mention at_you/received_at ${JSON.stringify(envelope)}`);
  }
  if (envelope.tray_state !== "live" || envelope.identity.as_user !== true || envelope.identity.actor_id !== "nyfeblade") {
    fail(`mention identity ${JSON.stringify(envelope.identity)} tray=${envelope.tray_state}`);
  }
  if (envelope.payload.repository.full_name !== "nyfeblade/rd-os" || envelope.payload.reason !== "mention") {
    fail(`mention payload ${JSON.stringify(envelope.payload)}`);
  }
  const review = mapNotification(notes.review_request, { has_token: true });
  if (!review.ok || review.data.event !== "pull_request" || review.data.at_you !== true) {
    fail(`review_request map ${JSON.stringify(review)}`);
  }
  const subscribed = mapNotification(notes.subscribed, { has_token: false });
  if (!subscribed.ok || subscribed.data.at_you !== false || subscribed.data.tray_state !== "needs_auth") {
    fail(`subscribed map ${JSON.stringify(subscribed)}`);
  }
  const release = mapNotification(notes.release, { has_token: true });
  if (release.ok || release.code !== "UNKNOWN_EVENT") {
    fail(`release should be UNKNOWN_EVENT ${JSON.stringify(release)}`);
  }
  const ingestDoc = fs.readFileSync(path.join(ROOT, "INGEST.md"), "utf8");
  if (!ingestDoc.includes("subject.type") || !ingestDoc.includes("issue_comment") || !ingestDoc.includes("ARCHITECTURE.md")) {
    fail("INGEST.md missing notification → envelope mapping");
  }
  process.stdout.write("PASS notifications → ingest envelope\n");

  const ciSet = Boolean(process.env.CI);
  const liveOpt = String(process.env.GITHUB_LIVE || "").trim() === "1";
  const liveToken = String(process.env.GITHUB_TOKEN || "").trim();
  if (ciSet || !liveOpt || !liveToken) {
    const why = ciSet ? "CI" : !liveOpt ? "GITHUB_LIVE!=1" : "no GITHUB_TOKEN";
    process.stdout.write(`PASS live integration skipped (${why})\n`);
  } else {
    const liveClient = createGithubClient({
      env: process.env,
      tokenProvider: envTokenProvider(process.env),
    });
    const liveRepo = await liveClient.repo(process.env.GITHUB_REPO || "nyfeblade/rd-os");
    if (!liveRepo.ok) {
      fail(`optional live repo ${JSON.stringify(liveRepo)}`);
    }
    process.stdout.write("PASS live integration GET repo\n");
  }

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
    `PASS studio-github (browse + gated egress + ingest map; wall_ms=${wallMs}; not a 14d verdict)\n`
  );
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
