"use strict";

const { complete, createComplete, resolveProviderName, SHIPPED_PROVIDER } = require("./complete");
const { createOpenAIAdapter, DEFAULT_BASE_URL, DEFAULT_MODEL } = require("./openai");
const {
  REJECT_CODES,
  reject,
  ok,
  assertNeverReject,
  assertNeverProvider,
  describeReject,
  isResourceExhausted,
} = require("./errors");

module.exports = {
  complete,
  createComplete,
  resolveProviderName,
  SHIPPED_PROVIDER,
  createOpenAIAdapter,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  REJECT_CODES,
  reject,
  ok,
  assertNeverReject,
  assertNeverProvider,
  describeReject,
  isResourceExhausted,
};
