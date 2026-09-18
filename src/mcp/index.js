"use strict";

const { REJECT_CODES, reject, ok, assertNeverReject, assertNeverTool } = require("./reject");
const { TOOLS, TOOL_SCHEMAS, listToolDescriptors, isMutator } = require("./tools");
const { createIdempotencyStore } = require("./idempotency");
const { createGateStore } = require("./gates");
const { loadPlane } = require("./adapters/plane");
const { dispatchTool } = require("./dispatch");

function createMcpContract(options = {}) {
  const plane = options.plane || loadPlane(options.home);
  const gates = options.gates || createGateStore();
  const idempotency = options.idempotency || createIdempotencyStore();
  const runtime = { plane, gates, idempotency, home: options.home || null };

  function dispatch(tool, payload, ctx) {
    return dispatchTool(runtime, tool, payload, ctx || {});
  }

  return {
    planeKind: plane.kind || "unknown",
    dispatch,
    listTools: listToolDescriptors,
    tools: TOOLS.slice(),
    rejectCodes: REJECT_CODES.slice(),
    plane,
  };
}

module.exports = {
  REJECT_CODES,
  TOOLS,
  TOOL_SCHEMAS,
  createMcpContract,
  listToolDescriptors,
  isMutator,
  reject,
  ok,
  assertNeverReject,
  assertNeverTool,
};
