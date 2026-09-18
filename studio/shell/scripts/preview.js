"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { createChatSession } = require("../lib/chat-bridge");
const { tryReadCatalogP0 } = require("../lib/read-catalog");
const { createSeatsSession } = require("../lib/seats-bridge");
const { runSeatConnectClick } = require("../lib/seat-connect");
const { demoInbox, mergeWireConnectors, sendReply } = require("../lib/two-way");

const chatSession = createChatSession();
const seatsSession = createSeatsSession({ env: process.env });
chatSession.bind().catch((err) => {
  process.stderr.write(`chat bind: ${err && err.message ? err.message : String(err)}\n`);
});

const ROOT = path.join(__dirname, "..", "renderer");
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, payload, status) {
  res.writeHead(status || 200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendChat(res, work) {
  Promise.resolve()
    .then(work)
    .then((result) => {
      sendJson(res, result);
    })
    .catch((err) => {
      sendJson(res, {
        ok: false,
        code: "GIT_EXEC",
        detail: err && err.message ? err.message : String(err),
      }, 500);
    });
}

function readJson(req, done) {
  const chunks = [];
  req.on("data", (chunk) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch (_err) {
      body = {};
    }
    done(body);
  });
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.normalize(path.join(root, rel));
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/catalog.json") {
    const rows = mergeWireConnectors(tryReadCatalogP0());
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(rows));
    return;
  }
  if (urlPath === "/twoway/inbox.json") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(demoInbox()));
    return;
  }
  if (urlPath === "/twoway/reply" && req.method === "POST") {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      let draft = {};
      try {
        draft = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch (_err) {
        draft = {};
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(sendReply(draft)));
    });
    return;
  }
  if (urlPath === "/chat/state" && req.method === "GET") {
    sendJson(res, { ok: true, state: chatSession.state() });
    return;
  }
  if (urlPath === "/chat/bind" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.bind(body && body.repo));
    });
    return;
  }
  if (urlPath === "/chat/send" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.send(body && body.text));
    });
    return;
  }
  if (urlPath === "/chat/refresh" && req.method === "POST") {
    sendChat(res, () => chatSession.refresh());
    return;
  }
  if (urlPath === "/chat/focus" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.setCodeFocus(Boolean(body && body.open)));
    });
    return;
  }
  if (urlPath === "/seats/providers" && req.method === "GET") {
    sendJson(res, { ok: true, providers: seatsSession.providers() });
    return;
  }
  if (urlPath === "/seats/list" && req.method === "GET") {
    sendJson(res, seatsSession.list());
    return;
  }
  if (urlPath === "/seats/presence" && req.method === "GET") {
    sendJson(res, seatsSession.presence());
    return;
  }
  if (urlPath === "/seats/connect" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, runSeatConnectClick({
        session: seatsSession,
        provider: body && body.provider,
      }));
    });
    return;
  }
  const file = safeJoin(ROOT, req.url || "/");
  if (!file) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      res.end(err.code === "ENOENT" ? "not found" : "error");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Studio preview  http://127.0.0.1:${PORT}\n`);
});
