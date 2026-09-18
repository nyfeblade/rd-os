"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createKernel, TOOLS } = require("./kernel");
const { runProofLayerReject, loadPacketIfPresent, copyEvidence } = require("./proof-layer");
const { runKill14d } = require("./kill14d");
const { listTools, SERVER_INFO } = require("./mcp-server");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function createLabServer(options = {}) {
  const root = options.root || path.resolve(__dirname, "..");
  const uiDir = path.join(root, "ui");
  const kernel = createKernel(options.home);
  const listeners = new Set();

  if (options.seed !== false) {
    seedIfEmpty(kernel, root);
  }

  function snapshot() {
    const dump = kernel.persistAttention();
    return {
      attention: dump,
      experiments: kernel.store.listExperiments(),
      packets: kernel.store.listPackets(),
      baselines: kernel.store.listBaselines(),
      events: kernel.store.listEvents(40),
      tools: TOOLS,
      mcp: {
        command: "node bin/mcp.js",
        transport: "stdio",
        serverInfo: SERVER_INFO,
        tools: listTools(),
      },
      home: kernel.store.home,
      clock_started: false,
      verdict: null,
    };
  }

  function broadcast() {
    const payload = `event: attention\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of listeners) {
      res.write(payload);
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, snapshot());
    }
    if (req.method === "GET" && url.pathname === "/api/attention") {
      return sendJson(res, 200, { ok: true, data: kernel.dispatch("attention.dump", {}) });
    }
    if (req.method === "GET" && url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: attention\ndata: ${JSON.stringify(snapshot())}\n\n`);
      listeners.add(res);
      req.on("close", () => listeners.delete(res));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/tool") {
      return readJson(req, res, (body) => {
        const actor = body.actor || req.headers["x-rdos-actor"] || "agent";
        const result = kernel.dispatch(body.tool, body.payload || {}, { actor });
        kernel.store.appendEvent({ kind: "tool", tool: body.tool, ok: result.ok, code: result.code || null });
        broadcast();
        sendJson(res, result.ok ? 200 : 409, result);
      });
    }
    if (req.method === "POST" && url.pathname === "/api/steer") {
      return readJson(req, res, (body) => {
        const result = kernel.dispatch("steer.gate", body, { actor: "human" });
        kernel.store.appendEvent({ kind: "steer", ok: result.ok, code: result.code || null });
        broadcast();
        sendJson(res, result.ok ? 200 : 409, result);
      });
    }
    if (req.method === "POST" && url.pathname === "/api/proof-layer") {
      const hooked = runProofLayerReject({ repoRoot: root });
      const packet = loadPacketIfPresent(hooked);
      const evidence = copyEvidence(hooked, { repoRoot: root, home: kernel.store.home });
      if (packet) {
        kernel.dispatch("claim.submit", {
          experiment_id: packet.experiment_id || "exp-1-planted-false",
          packet,
          packet_uri: hooked.packet_path,
        });
      }
      kernel.store.appendEvent({
        kind: "proof-layer",
        runner_result: hooked.runner_result,
        measured_exit: hooked.measured_exit,
        ok: hooked.ok,
      });
      broadcast();
      return sendJson(res, hooked.ok ? 200 : 409, {
        ...hooked,
        evidence,
        verdict: null,
        stdout: hooked.stdout,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/kill14d") {
      return readJson(req, res, (body) => {
        const report = runKill14d({
          arm: body.arm || "rdos",
          day: body.day == null ? 0 : body.day,
          home: path.join(kernel.store.home, "kill14d-ui"),
          skipM1: body.skip_m1 !== false,
        });
        sendJson(res, 200, report);
      });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return sendFile(res, path.join(uiDir, "index.html"));
    }
    if (req.method === "GET" && url.pathname.startsWith("/ui/")) {
      return sendFile(res, path.join(uiDir, url.pathname.slice(4)));
    }
    const rel = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
    const abs = path.normalize(path.join(uiDir, rel));
    if (req.method === "GET" && abs.startsWith(uiDir) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return sendFile(res, abs);
    }
    sendJson(res, 404, { ok: false, code: "UNKNOWN_TOOL", detail: `no route ${req.method} ${url.pathname}` });
  });

  return { server, kernel, snapshot, broadcast };
}

function seedIfEmpty(kernel, root) {
  if (kernel.store.listExperiments().length) {
    return;
  }
  const seedPath = path.join(root, "fixtures", "lab", "seed.json");
  if (!fs.existsSync(seedPath)) {
    return;
  }
  kernel.dispatch("experiment.open", JSON.parse(fs.readFileSync(seedPath, "utf8")));
}

function sendJson(res, status, body) {
  const text = `${JSON.stringify(body, null, 2)}\n`;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendFile(res, abs) {
  const ext = path.extname(abs);
  const data = fs.readFileSync(abs);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": data.length,
  });
  res.end(data);
}

function readJson(req, res, next) {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    if (!chunks.length) {
      next({});
      return;
    }
    try {
      next(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    } catch (err) {
      sendJson(res, 400, { ok: false, code: "UNKNOWN_TOOL", detail: `invalid JSON: ${err.message}` });
    }
  });
}

module.exports = {
  createLabServer,
};
