#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const {
  CONSUMER_ROOT,
  resolveLab,
  assertLab,
  extractContractTools,
  readCommittedAttachConfig,
} = require("../lib/lab");

function fail(message) {
  process.stderr.write(`FAIL cursor-mcp: ${message}\n`);
  process.exit(1);
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

function parseToolResult(message) {
  if (!message || !message.result) {
    throw new Error("tools/call missing result");
  }
  if (message.result.structuredContent && typeof message.result.structuredContent === "object") {
    return message.result.structuredContent;
  }
  const text = message.result.content && message.result.content[0] && message.result.content[0].text;
  if (typeof text !== "string") {
    throw new Error("tools/call missing content text");
  }
  return JSON.parse(text);
}

function loadWeightOnlyPayload() {
  const payloadPath = path.join(CONSUMER_ROOT, "payloads", "weight-only.json");
  return JSON.parse(fs.readFileSync(payloadPath, "utf8"));
}

function main() {
  const started = Date.now();
  let attach;
  try {
    attach = readCommittedAttachConfig();
  } catch (err) {
    fail(err.message || String(err));
  }

  let labInfo;
  try {
    labInfo = assertLab(resolveLab());
  } catch (err) {
    fail(err.message || String(err));
  }

  const contractText = fs.readFileSync(labInfo.contractPath, "utf8");
  let contractTools;
  try {
    contractTools = extractContractTools(contractText);
  } catch (err) {
    fail(err.message || String(err));
  }

  const home = fs.mkdtempSync(path.join(os.tmpdir(), "rdos-cursor-mcp-"));
  const child = spawn(process.execPath, [labInfo.mcpJs], {
    env: { ...process.env, RDOS_HOME: home, RDOS_ACTOR: "agent" },
    stdio: ["pipe", "pipe", "inherit"],
  });

  let nextId = 1;
  const pending = new Map();
  const parser = createFrameParser((message) => {
    if (message && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  child.stdout.on("data", (chunk) => parser.push(chunk));

  function call(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 8000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(encodeFramed({ jsonrpc: "2.0", id, method, params }));
    });
  }

  function shutdown(code) {
    try {
      child.kill("SIGTERM");
    } catch (_err) {
      // already gone
    }
    process.exit(code);
  }

  Promise.resolve()
    .then(async () => {
      process.stdout.write(`cursor-mcp: lab ${labInfo.lab}\n`);
      process.stdout.write(`cursor-mcp: attach stdio ${labInfo.mcpJs}\n`);
      process.stdout.write(`cursor-mcp: RDOS_HOME ${home}\n`);
      process.stdout.write(`cursor-mcp: mcp.json ${attach.configPath} → ${attach.config.mcpServers["rd-os"].args[0]}\n`);
      process.stdout.write(`cursor-mcp: node ${process.version}\n`);

      const init = await call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "rd-os-cursor-mcp" },
      });
      if (!init.result || !init.result.serverInfo || init.result.serverInfo.name !== "rd-os") {
        fail("initialize missing rd-os serverInfo");
      }
      process.stdout.write(
        `cursor-mcp: initialize ok serverInfo=${init.result.serverInfo.name}@${init.result.serverInfo.version}\n`
      );

      const listed = await call("tools/list", {});
      const names = (listed.result && listed.result.tools ? listed.result.tools : []).map((tool) => tool.name);
      process.stdout.write(`cursor-mcp: tools/list (${names.length}) ${names.join(" ")}\n`);
      process.stdout.write(`cursor-mcp: MCP_CONTRACT tools (${contractTools.length}) ${contractTools.join(" ")}\n`);

      const missing = contractTools.filter((name) => !names.includes(name));
      if (missing.length) {
        fail(`tools/list missing contract tools: ${missing.join(",")}`);
      }
      process.stdout.write("PASS tools/list includes MCP_CONTRACT tools\n");

      const weightPayload = loadWeightOnlyPayload();
      const weightCall = await call("tools/call", {
        name: "claim.submit",
        arguments: weightPayload,
      });
      const weightBody = parseToolResult(weightCall);
      process.stdout.write(`cursor-mcp: claim.submit weight-only => ${JSON.stringify(weightBody)}\n`);
      if (weightBody.ok || weightBody.code !== "WEIGHT_ONLY") {
        fail(`expected WEIGHT_ONLY reject, got ${JSON.stringify(weightBody)}`);
      }
      process.stdout.write(`PASS WEIGHT_ONLY reject code=${weightBody.code}\n`);

      const wallMs = Date.now() - started;
      process.stdout.write(
        `PASS cursor-mcp (measured MCP attach + WEIGHT_ONLY; wall_ms=${wallMs}; not a 14d verdict)\n`
      );
      shutdown(0);
    })
    .catch((err) => {
      try {
        child.kill("SIGTERM");
      } catch (_killErr) {
        // already gone
      }
      fail(err.message || String(err));
    });
}

main();
