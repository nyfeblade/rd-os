"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { tryReadCatalogP0 } = require("../lib/read-catalog");
const { demoInbox, mergeWireConnectors, sendReply } = require("../lib/two-way");

const ROOT = path.join(__dirname, "..", "renderer");
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

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
