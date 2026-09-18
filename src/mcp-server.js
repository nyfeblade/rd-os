"use strict";

const { createKernel, TOOLS } = require("./kernel");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "rd-os", version: "0.3.0" };

const TOOL_SCHEMAS = {
  "experiment.open": {
    description:
      "Open an experiment packet. Requires machine-time fields. Rejects HUMAN_WEEK_WITHOUT_GATE and UNDER_SCOPE replacements.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        title: { type: "string" },
        estimate_ca_hours: { type: "number" },
        estimate_proof_min: { type: "number" },
        human_gates: { type: "array", items: { type: "object" } },
        actuals: { type: "object" },
        opened_n: { type: "number" },
        kill: { type: "string" },
        instrument: { type: "string" },
        constraint: { type: "string" },
      },
      required: ["experiment_id", "title", "estimate_ca_hours", "estimate_proof_min", "human_gates", "actuals"],
    },
  },
  "experiment.record_actuals": {
    description: "Write numeric actuals.ca_hours / actuals.proof_min. Optionally mark finished.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        actuals: { type: "object" },
        finished: { type: "boolean" },
        stage: { type: "string" },
      },
      required: ["experiment_id", "actuals"],
    },
  },
  "envelope.query": {
    description: "Query finished CA-hour baselines. Never rejects; may return NO_BASELINE.",
    inputSchema: {
      type: "object",
      properties: {
        similar: { type: "string" },
        experiment_id: { type: "string" },
        title: { type: "string" },
      },
    },
  },
  "envelope.record": {
    description: "Kernel-side baseline after stage=finished and numeric actuals.ca_hours.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        instrument: { type: "string" },
        runner_result: { type: "string" },
        packet_uri: { type: "string" },
      },
      required: ["experiment_id"],
    },
  },
  "plan.fanout": {
    description: "Record N fetch|run probes. n<2 requires a named physics/human constraint.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        n: { type: "integer" },
        probes: { type: "array", items: { type: "object" } },
        constraint: { type: "string" },
      },
      required: ["experiment_id"],
    },
  },
  "plan.accept": {
    description:
      "ACCEPT only after fan-out evidence, anti-single-lane, envelope query or NO_BASELINE, and no UNDER_SCOPE.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        n: { type: "integer" },
        probes: { type: "array", items: { type: "object" } },
        fanout: { type: "object" },
        constraint: { type: "string" },
        envelope_query_id: { type: "string" },
        envelope: { type: "string" },
        no_baseline: { type: "boolean" },
        recombine: { type: "string" },
        kill: { type: "string" },
        instrument: { type: "string" },
        estimate_ca_hours: { type: "number" },
      },
      required: ["experiment_id"],
    },
  },
  "claim.submit": {
    description: "Submit a Proof Layer (or equivalent) packet. Weight-only and markdown are rejected. verdict stays null.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        packet: { type: "object" },
        packet_uri: { type: "string" },
        evidence_uri: { type: "string" },
        runner_result: { type: "string" },
        measured_exit: { type: "number" },
        body: { type: "string" },
        claim: { type: "string" },
        text: { type: "string" },
        verdict: {},
      },
    },
  },
  "claim.verdict_draft": {
    description: "Draft only. Setting verdict is SELF_CERT. Eng Proof owns verdict.",
    inputSchema: {
      type: "object",
      properties: {
        runner_result: { type: "string" },
        verdict: {},
      },
    },
  },
  "attention.dump": {
    description: "Return P0 and HARD LAW as siblings. Always succeeds.",
    inputSchema: { type: "object", properties: {} },
  },
  "steer.gate": {
    description: "Human only. Agents receive NOT_HUMAN. Add or resolve human_gates[].",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        kind: { type: "string" },
        reason: { type: "string" },
        resolve: { type: "string" },
      },
      required: ["experiment_id"],
    },
  },
};

function assertNeverTool(tool) {
  throw new Error(`unhandled McpTool: ${tool}`);
}

function listTools() {
  return TOOLS.map((name) => {
    const spec = TOOL_SCHEMAS[name];
    if (!spec) {
      return assertNeverTool(name);
    }
    return {
      name,
      description: spec.description,
      inputSchema: spec.inputSchema,
    };
  });
}

function createMcpServer(options = {}) {
  const kernel = createKernel(options.home);
  const actor = options.actor || "agent";

  function handleMessage(message) {
    if (!message || typeof message !== "object") {
      return errorResponse(null, -32600, "Invalid Request");
    }
    if (message.method && String(message.method).startsWith("notifications/")) {
      return null;
    }
    const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
    switch (message.method) {
      case "initialize":
        return okResponse(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      case "ping":
        return okResponse(id, {});
      case "tools/list":
        return okResponse(id, { tools: listTools() });
      case "tools/call":
        return callTool(id, message.params || {});
      default:
        return errorResponse(id, -32601, `Method not found: ${message.method || ""}`);
    }
  }

  function callTool(id, params) {
    const name = params.name;
    const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    const result = kernel.dispatch(name, args, { actor });
    const text = JSON.stringify(result, null, 2);
    return okResponse(id, {
      content: [{ type: "text", text }],
      isError: result.ok === false,
      structuredContent: result,
    });
  }

  return {
    kernel,
    handleMessage,
    listTools,
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
  };
}

function okResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function encodeFramed(message) {
  const body = Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

function createFrameParser(onMessage) {
  let buffer = Buffer.alloc(0);

  function push(chunk) {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (true) {
      const headerEnd = indexOfHeaderEnd(buffer);
      if (headerEnd < 0) {
        if (tryNewlineJson()) {
          continue;
        }
        return;
      }
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.slice(headerEnd + headerSkip(buffer, headerEnd));
        continue;
      }
      const length = Number(lengthMatch[1]);
      const start = headerEnd + headerSkip(buffer, headerEnd);
      if (buffer.length < start + length) {
        return;
      }
      const body = buffer.slice(start, start + length).toString("utf8").trim();
      buffer = buffer.slice(start + length);
      if (body) {
        onMessage(JSON.parse(body));
      }
    }
  }

  function tryNewlineJson() {
    const nl = buffer.indexOf(0x0a);
    if (nl < 0) {
      return false;
    }
    const line = buffer.slice(0, nl).toString("utf8").replace(/\r$/, "").trim();
    if (!line.startsWith("{")) {
      return false;
    }
    try {
      const parsed = JSON.parse(line);
      buffer = buffer.slice(nl + 1);
      onMessage(parsed);
      return true;
    } catch (_err) {
      return false;
    }
  }

  return { push };
}

function indexOfHeaderEnd(buffer) {
  const crlf = buffer.indexOf("\r\n\r\n");
  if (crlf >= 0) {
    return crlf;
  }
  return buffer.indexOf("\n\n");
}

function headerSkip(buffer, headerEnd) {
  if (buffer.slice(headerEnd, headerEnd + 4).toString("utf8") === "\r\n\r\n") {
    return 4;
  }
  return 2;
}

function attachStdio(server, stdin, stdout) {
  const parser = createFrameParser((message) => {
    const response = server.handleMessage(message);
    if (response) {
      stdout.write(encodeFramed(response));
    }
  });
  stdin.on("data", (chunk) => parser.push(chunk));
}

module.exports = {
  PROTOCOL_VERSION,
  SERVER_INFO,
  TOOL_SCHEMAS,
  createMcpServer,
  encodeFramed,
  createFrameParser,
  attachStdio,
  listTools,
};
