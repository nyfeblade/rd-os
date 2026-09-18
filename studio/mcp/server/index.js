"use strict";

const { createSession, unknownProvider } = require("../lib/session");
const { isProviderId } = require("../lib/providers");
const { permissionFor } = require("../lib/permissions");
const { bindInfo } = require("../lib/git");
const { createChatSurface, defaultChatHome } = require("../lib/chat");
const { listGates } = require("../lib/board");
const {
  PROTOCOL_VERSION,
  SERVER_INFO,
  TOOLS,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  PRODUCT_LOCK,
  FENCE,
  PRODUCT,
  ok,
  reject,
  assertNeverTool,
  negotiateProtocol,
  describeReject,
} = require("../lib/codes");
const { TOOL_SCHEMAS, listToolDescriptors } = require("./tools");
const { okResponse, errorResponse, encodeFramed, createFrameParser, attachStdio } = require("./protocol");

function createStudioMcpServer(options) {
  const opts = options || {};
  if (!isProviderId(opts.provider)) {
    const err = new Error(unknownProvider(opts.provider).detail);
    err.code = "UNKNOWN_PROVIDER";
    throw err;
  }
  const session = createSession(opts);
  const repo = opts.repo || opts.cwd || process.env.STUDIO_REPO || process.cwd();
  const chat = createChatSurface({
    chatEngine: opts.chatEngine,
    chatHome: opts.chatHome || defaultChatHome(opts.home),
    clock: opts.clock,
    github: opts.github,
    env: opts.env,
    repo,
  });

  async function dispatchTool(name, args) {
    switch (name) {
      case "studio.seats.list":
        return listSeats(args);
      case "studio.seats.presence":
        return readPresence(args);
      case "studio.chat.snapshot":
        return chat.snapshot(args);
      case "studio.board.list_gates":
        return listGates(args);
      case "studio.repo.bind_info":
        return bindInfo({ cwd: args && args.cwd ? args.cwd : repo });
      default:
        return assertNeverTool(name);
    }
  }

  function listSeats(args) {
    const listed = session.studio.seats.list();
    if (!listed.ok) {
      return listed;
    }
    const kind = args && args.kind;
    const seats = kind ? listed.data.seats.filter((seat) => seat.kind === kind) : listed.data.seats;
    return ok({
      seats,
      session_provider: session.provider.id,
      product_lock: PRODUCT_LOCK,
      in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    });
  }

  function readPresence(args) {
    if (args && args.id) {
      return session.studio.presence.get(String(args.id));
    }
    return session.studio.presence.list();
  }

  function allowedTools() {
    return TOOLS.filter((name) => permissionFor(session.provider.id, name).kind === "allow");
  }

  function toolResult(id, result) {
    const body = result && typeof result === "object" ? result : reject("BAD_ARGUMENTS", "tool returned a non-object");
    return okResponse(id, {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      isError: body.ok === false,
      structuredContent: body,
    });
  }

  async function callTool(id, params) {
    if (!session.isConnected()) {
      return toolResult(id, reject("NOT_CONNECTED", describeReject("NOT_CONNECTED")));
    }
    const name = params && params.name;
    const args = params && params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    const perm = permissionFor(session.provider.id, name);
    switch (perm.kind) {
      case "allow":
        return toolResult(id, await dispatchTool(name, args));
      case "deny":
        return toolResult(id, reject("TOOL_FORBIDDEN", `${name} is forbidden for ${session.provider.id}`));
      case "hitl":
        return toolResult(
          id,
          reject("HITL_REQUIRED", perm.detail, { class: perm.class, hitl: true })
        );
      case "unknown_provider":
        return toolResult(id, unknownProvider(session.provider.id));
      case "unknown_tool":
        return toolResult(id, reject("UNKNOWN_TOOL", `unknown tool: ${name || ""}`));
      default:
        throw new Error(`unhandled permission kind: ${perm.kind}`);
    }
  }

  async function handleMessage(message) {
    if (!message || typeof message !== "object") {
      return errorResponse(null, -32600, "Invalid Request");
    }
    if (message.method && String(message.method).startsWith("notifications/")) {
      if (message.method === "notifications/exit") {
        session.disconnect();
      }
      return null;
    }
    const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
    switch (message.method) {
      case "initialize":
        return initialize(id, message.params || {});
      case "ping":
        return okResponse(id, {});
      case "tools/list":
        if (!session.isConnected()) {
          return toolResult(id, reject("NOT_CONNECTED", describeReject("NOT_CONNECTED")));
        }
        return okResponse(id, { tools: listToolDescriptors(allowedTools()) });
      case "tools/call":
        return callTool(id, message.params || {});
      case "shutdown":
        session.disconnect();
        return okResponse(id, {});
      default:
        return errorResponse(id, -32601, `Method not found: ${message.method || ""}`);
    }
  }

  function initialize(id, params) {
    const connected = session.connect();
    if (!connected.ok) {
      return toolResult(id, connected);
    }
    const protocolVersion = negotiateProtocol(params.protocolVersion);
    return okResponse(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: [
        `${PRODUCT} first-party MCP (${FENCE}).`,
        CONNECT_ACK,
        "Legal speech is in-studio rooms only. Merge / deploy / DB / public post still require Board HITL.",
      ].join(" "),
    });
  }

  return {
    session,
    chat,
    handleMessage,
    connect: () => session.connect(),
    disconnect: () => session.disconnect(),
    listTools: () => listToolDescriptors(allowedTools()),
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
  };
}

module.exports = {
  PROTOCOL_VERSION,
  SERVER_INFO,
  TOOLS,
  TOOL_SCHEMAS,
  createStudioMcpServer,
  encodeFramed,
  createFrameParser,
  attachStdio,
};
