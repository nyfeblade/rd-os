"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { createChatSession } = require("../lib/chat-bridge");
const { tryReadCatalogP0 } = require("../lib/read-catalog");
const { mergeWireConnectors, sendReply } = require("../lib/two-way");
const { createStudioLive } = require("../lib/studio-live");
const { createSeatsSession } = require("../lib/seats-bridge");
const { runSeatConnectClick } = require("../lib/seat-connect");

const ROOT = path.join(__dirname, "..", "renderer");
const PORT = Number(process.env.PORT || 5173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
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
      sendJson(
        res,
        {
          ok: false,
          code: "GIT_EXEC",
          detail: err && err.message ? err.message : String(err),
        },
        500,
      );
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

function catalogRows() {
  return mergeWireConnectors(tryReadCatalogP0());
}

function createPreviewContext(options) {
  const opts = options || {};
  const live =
    opts.live ||
    createStudioLive({
      varDir: opts.varDir,
      platform: opts.platform || process.platform,
      env: opts.env,
      authHome: opts.authHome,
    });
  const seatsSession =
    opts.seatsSession ||
    createSeatsSession({
      studio: live.seats,
      home: opts.seatsHome || (opts.varDir ? path.join(opts.varDir, "seats") : undefined),
      env: opts.env,
    });
  const chatSession = opts.chatSession || createChatSession({ varDir: opts.varDir });
  if (!opts.skipBind) {
    chatSession.bind().catch((err) => {
      process.stderr.write(`chat bind: ${err && err.message ? err.message : String(err)}\n`);
    });
  }
  return { live, chatSession, seatsSession };
}

function handleApi(req, res, ctx) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const live = ctx.live;
  const chatSession = ctx.chatSession;
  const seatsSession = ctx.seatsSession;

  if (urlPath === "/catalog.json") {
    sendJson(res, catalogRows());
    return true;
  }
  if (urlPath === "/live/state" && req.method === "GET") {
    sendJson(res, live.snapshot(catalogRows()));
    return true;
  }
  if (urlPath === "/auth/session" && req.method === "GET") {
    sendJson(res, live.session());
    return true;
  }
  if (urlPath === "/auth/start" && req.method === "POST") {
    sendJson(res, live.startOAuth());
    return true;
  }
  if (urlPath === "/auth/sign-out" && req.method === "POST") {
    sendJson(res, live.signOut());
    return true;
  }
  if (urlPath === "/auth/callback" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => live.handleCallback(body));
    });
    return true;
  }
  if (urlPath === "/seats/dump" && req.method === "GET") {
    sendJson(res, live.dumpSeats());
    return true;
  }
  if (urlPath === "/seats/providers" && req.method === "GET") {
    sendJson(res, { ok: true, providers: seatsSession.providers() });
    return true;
  }
  if (urlPath === "/seats/list" && req.method === "GET") {
    sendJson(res, seatsSession.list());
    return true;
  }
  if (urlPath === "/seats/presence" && req.method === "GET") {
    sendJson(res, seatsSession.presence());
    return true;
  }
  if (urlPath === "/seats/import" && req.method === "POST") {
    sendJson(res, seatsSession.importTeam());
    return true;
  }
  if (urlPath === "/seats/connect" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, runSeatConnectClick({
        session: seatsSession,
        provider: body && body.provider,
      }));
    });
    return true;
  }
  if (urlPath === "/hitl/need-you" && req.method === "GET") {
    sendJson(res, live.listNeedYou());
    return true;
  }
  if (urlPath === "/hitl/create" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, live.createGate(body));
    });
    return true;
  }
  if (urlPath === "/hitl/resolve" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, live.resolveGate(body));
    });
    return true;
  }
  if (urlPath === "/market/browse" && req.method === "GET") {
    sendJson(res, live.browseMarket({}));
    return true;
  }
  if (urlPath === "/market/install" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, live.installMarket(body && body.id));
    });
    return true;
  }
  if (urlPath === "/market/connect" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, live.connectMarket(body && body.id, body));
    });
    return true;
  }
  if (urlPath === "/modes" && req.method === "GET") {
    sendJson(res, live.listModes());
    return true;
  }
  if (urlPath === "/modes/enable" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, live.enableMode(body && body.id));
    });
    return true;
  }
  if (urlPath === "/mcp/surface" && req.method === "GET") {
    sendJson(res, live.mcpSurface());
    return true;
  }
  if (urlPath === "/twoway/inbox.json" || urlPath === "/inbox.json") {
    sendJson(res, live.inbox());
    return true;
  }
  if (urlPath === "/twoway/reply" && req.method === "POST") {
    readJson(req, (body) => {
      sendJson(res, sendReply(body));
    });
    return true;
  }
  if (urlPath === "/chat/state" && req.method === "GET") {
    sendJson(res, { ok: true, state: chatSession.state() });
    return true;
  }
  if (urlPath === "/chat/bind" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.bind(body && body.repo));
    });
    return true;
  }
  if (urlPath === "/chat/send" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.send(body && body.text));
    });
    return true;
  }
  if (urlPath === "/chat/refresh" && req.method === "POST") {
    sendChat(res, () => chatSession.refresh());
    return true;
  }
  if (urlPath === "/chat/focus" && req.method === "POST") {
    readJson(req, (body) => {
      sendChat(res, () => chatSession.setCodeFocus(Boolean(body && body.open)));
    });
    return true;
  }
  return false;
}

function createPreviewServer(options) {
  const ctx = createPreviewContext(options);
  const server = http.createServer((req, res) => {
    if (handleApi(req, res, ctx)) {
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
  return { server, ctx };
}

function listen(options) {
  const port = options && options.port ? options.port : PORT;
  const { server, ctx } = createPreviewServer(options);
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Studio preview  http://127.0.0.1:${port}\n`);
  });
  return { server, ctx };
}

if (require.main === module) {
  listen();
}

module.exports = {
  createPreviewContext,
  createPreviewServer,
  handleApi,
  listen,
};
