"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createStudio } = require("./studio");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const SPA_PREFIXES = ["/code", "/tree", "/blob", "/pulls", "/connectors", "/surface"];

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body)}\n`);
}

function sendText(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function readJson(req, res, next) {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) {
      req.destroy();
      sendJson(res, 413, { ok: false, code: "GITHUB_HTTP", detail: "payload too large" });
    }
  });
  req.on("end", () => {
    if (!raw) {
      next({});
      return;
    }
    try {
      next(JSON.parse(raw));
    } catch (_err) {
      sendJson(res, 400, { ok: false, code: "GITHUB_HTTP", detail: "invalid json" });
    }
  });
}

function isSpaPath(pathname) {
  if (pathname === "/") {
    return true;
  }
  return SPA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function createStudioServer(options) {
  const root = options.root || path.resolve(__dirname, "..");
  const uiDir = path.join(root, "ui");
  const studio = createStudio(options);

  function sendFile(res, filePath) {
    const ext = path.extname(filePath);
    const type = MIME[ext] || "application/octet-stream";
    fs.readFile(filePath, (err, data) => {
      if (err) {
        sendText(res, 404, "text/plain; charset=utf-8", "not found\n");
        return;
      }
      sendText(res, 200, type, data);
    });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/api/state") {
      return void studio.state().then((result) => sendJson(res, result.ok ? 200 : 409, result));
    }
    if (req.method === "GET" && pathname === "/api/tree") {
      return void studio.tree(url.searchParams.get("path") || "").then((result) =>
        sendJson(res, result.ok ? 200 : 409, result)
      );
    }
    if (req.method === "GET" && pathname === "/api/blob") {
      return void Promise.resolve(studio.blob(url.searchParams.get("path") || "")).then((result) =>
        sendJson(res, result.ok ? 200 : 409, result)
      );
    }
    if (req.method === "GET" && pathname === "/api/pulls") {
      return void Promise.resolve(studio.pulls()).then((result) =>
        sendJson(res, result.ok ? 200 : 409, result)
      );
    }
    if (req.method === "GET" && pathname === "/api/connectors") {
      return sendJson(res, 200, studio.connectors());
    }
    if (req.method === "GET" && pathname === "/api/surface") {
      return sendJson(res, 200, studio.surface());
    }
    if (req.method === "GET" && pathname === "/api/pane") {
      return sendJson(res, 200, studio.pane());
    }
    if (req.method === "GET" && pathname === "/api/homebase") {
      return sendJson(res, 200, studio.homebase());
    }
    if (req.method === "POST" && pathname === "/api/pane/draw") {
      return sendJson(res, 200, studio.drawPane());
    }
    if (req.method === "POST" && pathname === "/api/pane/hide") {
      return sendJson(res, 200, studio.hidePane());
    }
    if (req.method === "GET" && pathname === "/api/rdos") {
      const hint = studio.rdosHint();
      return sendJson(res, hint.ok ? 200 : 409, hint);
    }
    if (req.method === "GET" && pathname.startsWith("/api/recipe/")) {
      const id = decodeURIComponent(pathname.slice("/api/recipe/".length));
      const result = studio.recipe(id);
      return sendJson(res, result.ok ? 200 : 404, result);
    }
    if (req.method === "POST" && pathname === "/api/connectors/attach") {
      return readJson(req, res, (body) => {
        const result = studio.attach(body.id, body);
        sendJson(res, result.ok ? 200 : 409, result);
      });
    }
    if (req.method === "POST" && pathname === "/api/source") {
      return readJson(req, res, (body) => {
        const result = studio.setSource(body.source);
        sendJson(res, result.ok ? 200 : 409, result);
      });
    }

    if (req.method === "GET" && isSpaPath(pathname)) {
      return sendFile(res, path.join(uiDir, "index.html"));
    }
    if (req.method === "GET") {
      const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(uiDir, safe);
      if (!filePath.startsWith(uiDir)) {
        return sendText(res, 404, "text/plain; charset=utf-8", "not found\n");
      }
      return sendFile(res, filePath);
    }
    sendJson(res, 404, { ok: false, code: "UNKNOWN_PATH", detail: pathname });
  });

  return { server, studio };
}

module.exports = { createStudioServer };
