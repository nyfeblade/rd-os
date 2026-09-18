"use strict";

const { reject, assertNeverProvider } = require("./errors");
const { createOpenAIAdapter } = require("./openai");

const SHIPPED_PROVIDER = "openai";

function resolveProviderName(env) {
  const raw = env && env.LLM_PROVIDER ? String(env.LLM_PROVIDER).trim().toLowerCase() : "";
  return raw || SHIPPED_PROVIDER;
}

function createKnownAdapter(name, deps) {
  switch (name) {
    case "openai":
      return createOpenAIAdapter(deps);
    default: {
      const _exhaustive = name;
      void _exhaustive;
      return null;
    }
  }
}

function createComplete(options) {
  const env = options && options.env ? options.env : process.env;
  const fetchImpl = options && options.fetch ? options.fetch : globalThis.fetch;
  const name = resolveProviderName(env);
  const adapter = createKnownAdapter(name, { env, fetch: fetchImpl });
  if (!adapter) {
    if (name === "openai") {
      assertNeverProvider(name);
    }
    return {
      provider: name,
      shipped: SHIPPED_PROVIDER,
      complete: async function completeUnknown() {
        return reject(
          "UNKNOWN_PROVIDER",
          `unsupported LLM_PROVIDER=${name}; shipped adapter is ${SHIPPED_PROVIDER}`
        );
      },
    };
  }
  return {
    provider: adapter.name,
    shipped: SHIPPED_PROVIDER,
    complete: (req) => adapter.complete(req),
  };
}

function complete(req, options) {
  return createComplete(options).complete(req);
}

module.exports = {
  SHIPPED_PROVIDER,
  resolveProviderName,
  createComplete,
  complete,
};
