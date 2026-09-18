"use strict";

const { reject, ok, isResourceExhausted } = require("./errors");

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 64;

function resolveBaseUrl(env) {
  const raw = env.OPENAI_BASE_URL && String(env.OPENAI_BASE_URL).trim();
  const base = raw || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

function resolveModel(req, env) {
  if (req && req.model && String(req.model).trim()) {
    return String(req.model).trim();
  }
  if (env.OPENAI_MODEL && String(env.OPENAI_MODEL).trim()) {
    return String(env.OPENAI_MODEL).trim();
  }
  return DEFAULT_MODEL;
}

function readPrompt(req) {
  if (!req || typeof req.prompt !== "string") {
    return "";
  }
  return req.prompt.trim();
}

function usageFrom(body) {
  if (!body || !body.usage || typeof body.usage !== "object") {
    return null;
  }
  return {
    prompt_tokens: Number.isFinite(body.usage.prompt_tokens) ? body.usage.prompt_tokens : null,
    completion_tokens: Number.isFinite(body.usage.completion_tokens) ? body.usage.completion_tokens : null,
    total_tokens: Number.isFinite(body.usage.total_tokens) ? body.usage.total_tokens : null,
  };
}

function extractText(body) {
  const choice = body && Array.isArray(body.choices) ? body.choices[0] : null;
  if (!choice || !choice.message) {
    return null;
  }
  return typeof choice.message.content === "string" ? choice.message.content : null;
}

function createOpenAIAdapter(deps) {
  const env = deps && deps.env ? deps.env : process.env;
  const fetchImpl = deps && deps.fetch ? deps.fetch : globalThis.fetch;

  async function complete(req) {
    const started = Date.now();
    const key = env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).trim();
    if (!key) {
      return reject("MISSING_KEY", "OPENAI_API_KEY is required for the openai adapter", {
        wall_ms: Date.now() - started,
      });
    }

    const prompt = readPrompt(req);
    if (!prompt) {
      return reject("MISSING_PROMPT", "prompt is required", { wall_ms: Date.now() - started });
    }

    if (typeof fetchImpl !== "function") {
      return reject("PROVIDER_ERROR", "fetch is not available", { wall_ms: Date.now() - started });
    }

    const model = resolveModel(req, env);
    const messages = [];
    if (req && typeof req.system === "string" && req.system.trim()) {
      messages.push({ role: "system", content: req.system.trim() });
    }
    messages.push({ role: "user", content: prompt });

    const payload = {
      model,
      messages,
      max_tokens:
        req && Number.isFinite(req.max_tokens) && req.max_tokens > 0 ? req.max_tokens : DEFAULT_MAX_TOKENS,
    };
    if (req && Number.isFinite(req.temperature)) {
      payload.temperature = req.temperature;
    }

    const url = `${resolveBaseUrl(env)}/chat/completions`;
    let response;
    try {
      // One request. ResourceExhausted ⇒ STOP. Do not retry.
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return reject("NETWORK_ERROR", err && err.message ? err.message : String(err), {
        wall_ms: Date.now() - started,
      });
    }

    const wallMs = Date.now() - started;
    let body = null;
    const rawText = typeof response.text === "function" ? await response.text() : "";
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch (_err) {
        body = { error: { message: rawText.slice(0, 300) } };
      }
    }

    if (isResourceExhausted(response.status, body)) {
      const detail =
        (body && body.error && body.error.message) ||
        `OpenAI ResourceExhausted HTTP ${response.status}`;
      return reject("RESOURCE_EXHAUSTED", `${detail} — STOP, no retry`, { wall_ms: wallMs });
    }

    if (!response.ok) {
      const detail =
        (body && body.error && body.error.message) || `OpenAI HTTP ${response.status}`;
      return reject("PROVIDER_ERROR", detail, { wall_ms: wallMs });
    }

    const text = extractText(body);
    if (typeof text !== "string") {
      return reject("PROVIDER_ERROR", "OpenAI response missing choices[0].message.content", {
        wall_ms: wallMs,
      });
    }

    return ok({
      text,
      model: (body && body.model) || model,
      provider: "openai",
      usage: usageFrom(body),
      wall_ms: wallMs,
    });
  }

  return {
    name: "openai",
    complete,
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  createOpenAIAdapter,
};
