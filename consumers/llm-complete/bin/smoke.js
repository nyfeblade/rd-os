#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  CONSUMER_ROOT,
  RELATIVE_ADAPTER,
  RELATIVE_MCP_RECIPE,
  assertLab,
  loadProviders,
  readRecipe,
  resolveLab,
} = require("../lib/lab");

function fail(message) {
  process.stderr.write(`FAIL llm-complete: ${message}\n`);
  process.exit(1);
}

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function countingFetch(handler) {
  const state = { calls: 0, urls: [], bodies: [] };
  async function fetchImpl(url, init) {
    state.calls += 1;
    state.urls.push(url);
    state.bodies.push(init && init.body ? JSON.parse(init.body) : null);
    return handler(url, init, state);
  }
  fetchImpl.state = state;
  return fetchImpl;
}

async function expectCode(label, result, code) {
  if (!result || result.ok || result.code !== code) {
    fail(`${label}: expected ${code}, got ${JSON.stringify(result)}`);
  }
  process.stdout.write(`PASS ${label} code=${result.code} wall_ms=${result.wall_ms}\n`);
  return result;
}

async function main() {
  const started = Date.now();
  let recipeInfo;
  try {
    recipeInfo = readRecipe();
  } catch (err) {
    fail(err.message || String(err));
  }

  let labInfo;
  try {
    labInfo = assertLab(resolveLab());
  } catch (err) {
    fail(err.message || String(err));
  }

  const providers = loadProviders(labInfo);
  const { complete, createComplete, SHIPPED_PROVIDER, REJECT_CODES, isResourceExhausted } = providers;

  process.stdout.write(`llm-complete: lab ${labInfo.lab}\n`);
  process.stdout.write(`llm-complete: adapter ${labInfo.adapterJs}\n`);
  process.stdout.write(`llm-complete: recipe ${recipeInfo.recipePath}\n`);
  process.stdout.write(`llm-complete: shipped provider ${SHIPPED_PROVIDER}\n`);
  process.stdout.write(`llm-complete: node ${process.version}\n`);

  if (SHIPPED_PROVIDER !== "openai") {
    fail(`expected shipped provider openai, got ${SHIPPED_PROVIDER}`);
  }
  if (recipeInfo.recipe.adapter !== RELATIVE_ADAPTER) {
    fail("recipe adapter path mismatch");
  }
  if (recipeInfo.recipe.mcp.see !== RELATIVE_MCP_RECIPE) {
    fail("recipe must sit beside consumers/cursor-mcp MCP attach");
  }
  process.stdout.write("PASS recipe names openai adapter beside cursor-mcp MCP\n");

  const mcpRecipe = path.resolve(CONSUMER_ROOT, RELATIVE_MCP_RECIPE);
  if (!fs.existsSync(mcpRecipe)) {
    fail(`existing MCP attach missing at ${mcpRecipe}`);
  }
  const mcpConfig = JSON.parse(fs.readFileSync(mcpRecipe, "utf8"));
  if (!mcpConfig.mcpServers || !mcpConfig.mcpServers["rd-os"]) {
    fail("consumers/cursor-mcp/.cursor/mcp.json missing rd-os server");
  }
  process.stdout.write("PASS existing cursor-mcp attach still present (not replaced)\n");

  const readmePath = path.join(CONSUMER_ROOT, "README.md");
  const readme = fs.readFileSync(readmePath, "utf8");
  if (!readme.includes("llm.complete") || !readme.includes("cursor-mcp") || !readme.includes("OPENAI_API_KEY")) {
    fail("README must document llm.complete beside cursor-mcp and OPENAI_API_KEY");
  }
  if (!/ResourceExhausted/.test(readme) || !/no retry/i.test(readme)) {
    fail("README must document ResourceExhausted ⇒ STOP, no retry");
  }
  process.stdout.write("PASS README documents OpenAI env key + MCP-beside recipe + STOP\n");

  if (!REJECT_CODES.includes("RESOURCE_EXHAUSTED")) {
    fail("REJECT_CODES missing RESOURCE_EXHAUSTED");
  }
  if (!isResourceExhausted(429, {}) || !isResourceExhausted(400, { error: { code: "insufficient_quota" } })) {
    fail("isResourceExhausted missed 429 / insufficient_quota");
  }
  process.stdout.write("PASS RESOURCE_EXHAUSTED detector (429 + insufficient_quota)\n");

  await expectCode(
    "MISSING_KEY",
    await complete({ prompt: "ping" }, { env: { LLM_PROVIDER: "openai" }, fetch: async () => fail("fetch must not run") }),
    "MISSING_KEY"
  );

  await expectCode(
    "MISSING_PROMPT",
    await complete(
      { prompt: "   " },
      { env: { LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }, fetch: async () => fail("fetch must not run") }
    ),
    "MISSING_PROMPT"
  );

  await expectCode(
    "UNKNOWN_PROVIDER",
    await complete({ prompt: "ping" }, { env: { LLM_PROVIDER: "anthropic", OPENAI_API_KEY: "sk-test" } }),
    "UNKNOWN_PROVIDER"
  );

  const okFetch = countingFetch(async () =>
    mockResponse(200, {
      model: "gpt-4o-mini",
      choices: [{ message: { content: "pong" } }],
      usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
    })
  );
  const okResult = await complete(
    { prompt: "Reply with the single word pong.", system: "terse", max_tokens: 16 },
    { env: { LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }, fetch: okFetch }
  );
  if (!okResult.ok || okResult.data.text !== "pong" || okResult.data.provider !== "openai") {
    fail(`expected mocked complete ok/pong, got ${JSON.stringify(okResult)}`);
  }
  if (okFetch.state.calls !== 1) {
    fail(`ok path fetch_calls=${okFetch.state.calls} (expected 1)`);
  }
  const sent = okFetch.state.bodies[0];
  if (!sent || sent.messages[sent.messages.length - 1].content.indexOf("pong") < 0) {
    fail("openai adapter did not send the user prompt");
  }
  process.stdout.write(
    `PASS mocked complete text=${JSON.stringify(okResult.data.text)} provider=${okResult.data.provider} wall_ms=${okResult.data.wall_ms}\n`
  );

  const exhausted429 = countingFetch(async () =>
    mockResponse(429, { error: { message: "Rate limit reached", type: "tokens", code: "rate_limit_exceeded" } })
  );
  const exhausted = await complete(
    { prompt: "ping" },
    { env: { OPENAI_API_KEY: "sk-test" }, fetch: exhausted429 }
  );
  await expectCode("RESOURCE_EXHAUSTED 429", exhausted, "RESOURCE_EXHAUSTED");
  if (!exhausted.stop) {
    fail("RESOURCE_EXHAUSTED must set stop=true");
  }
  if (exhausted429.state.calls !== 1) {
    fail(`429 path retried: fetch_calls=${exhausted429.state.calls}`);
  }
  process.stdout.write("PASS RESOURCE_EXHAUSTED 429 fetch_calls=1 (no retry)\n");

  const exhaustedQuota = countingFetch(async () =>
    mockResponse(400, { error: { message: "You exceeded your current quota", code: "insufficient_quota" } })
  );
  const quota = await createComplete({
    env: { OPENAI_API_KEY: "sk-test" },
    fetch: exhaustedQuota,
  }).complete({ prompt: "ping" });
  await expectCode("RESOURCE_EXHAUSTED quota", quota, "RESOURCE_EXHAUSTED");
  if (exhaustedQuota.state.calls !== 1) {
    fail(`quota path retried: fetch_calls=${exhaustedQuota.state.calls}`);
  }
  process.stdout.write("PASS RESOURCE_EXHAUSTED quota fetch_calls=1 (no retry)\n");

  if (process.env.LLM_COMPLETE_LIVE === "1") {
    if (!process.env.OPENAI_API_KEY) {
      fail("LLM_COMPLETE_LIVE=1 requires OPENAI_API_KEY");
    }
    const live = await complete({ prompt: "Reply with the single word pong.", max_tokens: 8 });
    if (!live.ok && live.code === "RESOURCE_EXHAUSTED") {
      process.stderr.write("FAIL llm-complete: live RESOURCE_EXHAUSTED — STOP, no retry\n");
      process.exit(3);
    }
    if (!live.ok) {
      fail(`live complete failed: ${JSON.stringify(live)}`);
    }
    process.stdout.write(`PASS live complete provider=${live.data.provider} wall_ms=${live.data.wall_ms}\n`);
  } else {
    process.stdout.write("PASS live skipped (no LLM_COMPLETE_LIVE=1; mocked path is the measurement)\n");
  }

  const wallMs = Date.now() - started;
  process.stdout.write(
    `PASS llm-complete (OpenAI llm.complete + Cursor recipe beside MCP; wall_ms=${wallMs}; not a 14d verdict)\n`
  );
}

main().catch((err) => {
  fail(err.message || String(err));
});
