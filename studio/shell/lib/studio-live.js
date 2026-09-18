"use strict";

/**
 * Live Studio kernels for the shell. Consume-only: auth, seats, hitl,
 * marketplace, modes, mcp, github ingest map. Chrome stays in the renderer.
 */

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createAuth, describeReject, DEFAULT_REDIRECT } = require("../../auth");
const { createStudioSeats, isImportableId } = require("../../seats");
const { createHitlKernel } = require("../../hitl");
const { resolveProvider, isKnownProvider } = require("./seats-bridge");
const { createStudioMarketplace } = require("../../marketplace");
const { createModeRegistry } = require("../../modes");
const { TOOLS, listProviders, SERVER_INFO, PROTOCOL_VERSION } = require("../../mcp");
const { mapNotification } = require("../../github/lib/notifications");

const AUTH_REL = "studio/auth";
const SEATS_REL = "studio/seats";
const HITL_REL = "studio/hitl";
const MARKET_REL = "studio/marketplace";
const MODES_REL = "studio/modes";
const MCP_REL = "studio/mcp";
const GITHUB_REL = "studio/github";
const AUTH_LOOPBACK_PORT = 7450;
const AUTH_REDIRECT = DEFAULT_REDIRECT;
const TRAFFIC_LIGHT_POSITION = Object.freeze({ x: 16, y: 18 });

const NOTES_FILE = path.resolve(__dirname, "..", "..", "github", "fixtures", "notifications.json");
const AUTH_ENV_FILE = path.resolve(__dirname, "..", "..", "auth", ".env");

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

function defaultVarDir() {
  return path.resolve(__dirname, "..", "var");
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadAuthEnv(extra) {
  return Object.assign({}, parseEnvFile(AUTH_ENV_FILE), process.env, extra || {});
}

function publicSession(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      code: result && result.code ? result.code : "BAD_ARGUMENT",
      detail: result && result.detail ? result.detail : "auth unavailable",
      session: null,
      message: result && result.code ? describeReject(result.code) : "auth unavailable",
    };
  }
  return {
    ok: true,
    code: null,
    detail: null,
    session: result.data || null,
    message: null,
  };
}

function githubTrayStatus(session) {
  if (session && typeof session === "object" && session.user) {
    return "live";
  }
  return "needs_auth";
}

function kindFromEnvelope(envelope) {
  switch (envelope.event) {
    case "issue_comment":
      return "comment";
    case "pull_request":
      return envelope.payload && envelope.payload.reason === "review_requested" ? "review_request" : "review";
    case "pull_request_review":
      return "review";
    case "pull_request_review_comment":
      return "review_comment";
    case "check_suite":
    case "workflow_run":
      return "ci_failure";
    default:
      return assertNever(envelope.event);
  }
}

function envelopeToInbox(envelope) {
  const kind = kindFromEnvelope(envelope);
  const repo = envelope.payload && envelope.payload.repository ? envelope.payload.repository.full_name : "";
  const title = envelope.payload && envelope.payload.subject ? envelope.payload.subject.title : kind;
  const needsGate = kind === "review_request" || kind === "ci_failure";
  return {
    id: `github:${kind}:${envelope.payload && envelope.payload.id ? envelope.payload.id : title}`,
    provider: "github",
    kind,
    need_you: envelope.at_you === true,
    needs_gate: needsGate,
    dest: needsGate ? "chat+board" : "chat",
    thread_ref: { repo },
    title: title || kind,
    body: title || kind,
    actor: { login: envelope.identity && envelope.identity.actor_id ? envelope.identity.actor_id : "github" },
    created_at: envelope.received_at,
    tray_state: envelope.tray_state,
    source: GITHUB_REL,
  };
}

function mapGithubInbox(session) {
  if (!session || !session.user) {
    return [];
  }
  if (!fs.existsSync(NOTES_FILE)) {
    return [];
  }
  const notes = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
  const items = [];
  for (const key of Object.keys(notes)) {
    const mapped = mapNotification(notes[key], {
      has_token: true,
      tray_state: "live",
      actor_id: session.user.login || "",
    });
    if (!mapped.ok) {
      continue;
    }
    const item = envelopeToInbox(mapped.data);
    if (item.need_you) {
      items.push(item);
    }
  }
  return items;
}

function chromeSeats(dump) {
  const seats = Array.isArray(dump.seats)
    ? dump.seats.map((seat) => ({
        id: seat.id,
        name: seat.label || seat.id,
        kind: seat.kind,
        presence: seat.presence,
        cutover: seat.cutover === "attached" || seat.cutover === true,
        in_studio_only: seat.in_studio_only === true,
        tools_allowed: seat.tools_allowed || [],
      }))
    : [];
  const rooms = Array.isArray(dump.rooms)
    ? dump.rooms
        .filter((room) => room.id === "room:chat")
        .map((room) => ({
          id: room.id,
          name: room.title || room.id,
          kind: "room",
          presence: "offline",
          cutover: false,
          in_studio_only: false,
        }))
    : [];
  return seats.concat(rooms);
}

function botAttached(seats) {
  return (seats || []).some((seat) => seat.kind === "bot" && seat.cutover === true);
}

function resolveAuthOpts(options) {
  const opts = options || {};
  const platform = opts.platform || process.platform;
  const varDir = opts.varDir ? path.resolve(opts.varDir) : defaultVarDir();
  const auth = {
    env: loadAuthEnv(opts.env),
    platform,
    redirectTo: opts.redirectTo || AUTH_REDIRECT,
  };
  if (opts.authHome) {
    auth.home = path.resolve(opts.authHome);
  } else if (platform !== "darwin") {
    auth.home = path.join(varDir, "auth");
  }
  return auth;
}

function createStudioLive(options) {
  const opts = options || {};
  const varDir = opts.varDir ? path.resolve(opts.varDir) : defaultVarDir();
  fs.mkdirSync(varDir, { recursive: true });

  const auth = createAuth(resolveAuthOpts({ ...opts, varDir }));
  const seats = createStudioSeats({ home: opts.seatsHome || path.join(varDir, "seats") });
  const hitl = createHitlKernel(opts.hitl || {});
  const market = createStudioMarketplace({ home: opts.marketHome || path.join(varDir, "marketplace") });
  const modes = createModeRegistry();
  let loopback = null;
  let lastAuthError = null;

  const human = seats.connect("human");
  if (!human.ok) {
    throw new Error(`seats.connect(human) failed: ${human.code}`);
  }

  function sessionPublic() {
    return publicSession(auth.session());
  }

  function dumpSeats() {
    const dumped = seats.dump();
    if (!dumped.ok) {
      return { ok: false, code: dumped.code, detail: dumped.detail, dump: null, seats: [] };
    }
    return {
      ok: true,
      dump: dumped.data,
      seats: chromeSeats(dumped.data),
      attached: dumped.data.cutover ? dumped.data.cutover.attached_seat_ids : [],
    };
  }

  function connectorsFrom(session, catalogRows) {
    const githubStatus = githubTrayStatus(session);
    const rows = Array.isArray(catalogRows) ? catalogRows.map((row) => ({ ...row })) : [];
    if (!rows.some((row) => row.id === "github")) {
      rows.unshift({ id: "github", label: "GitHub", status: githubStatus });
    }
    if (!rows.some((row) => row.id === "slack")) {
      rows.push({ id: "slack", label: "Slack", status: "needs_auth" });
    }
    return rows.map((row) => {
      if (row.id === "github") {
        return { ...row, status: githubStatus };
      }
      if (row.status === "live" && row.id !== "github") {
        return { ...row, status: "needs_auth" };
      }
      return { ...row, status: row.status || "needs_auth" };
    });
  }

  function applyGithubMarket(session) {
    if (!session || !session.user) {
      return;
    }
    const installed = market.install("github");
    if (installed.ok) {
      market.connect("github");
    }
  }

  function snapshot(catalogRows) {
    const authState = sessionPublic();
    const session = authState.session;
    const roster = dumpSeats();
    const needYou = hitl.listNeedYou();
    applyGithubMarket(session);
    const listedModes = modes.listModes();
    const active = modes.activeMode();
    return {
      ok: true,
      modules: {
        auth: AUTH_REL,
        seats: SEATS_REL,
        hitl: HITL_REL,
        marketplace: MARKET_REL,
        modes: MODES_REL,
        mcp: MCP_REL,
        github: GITHUB_REL,
      },
      auth: authState,
      lastAuthError,
      seats: roster.seats,
      dump: roster.dump,
      attached: roster.attached || [],
      in_studio: botAttached(roster.seats),
      gates: needYou.ok ? needYou.data.gates : [],
      inbox: mapGithubInbox(session),
      connectors: connectorsFrom(session, catalogRows),
      market: market.browse({}).ok ? market.browse({}).data : { entries: [] },
      modes: {
        list: listedModes.ok ? listedModes.data.modes : [],
        active: active.ok ? active.data : null,
      },
      mcp: {
        server: SERVER_INFO,
        protocol: PROTOCOL_VERSION,
        tools: TOOLS.slice(),
        providers: listProviders(),
      },
    };
  }

  function failAuth(result) {
    lastAuthError = {
      code: result.code,
      detail: result.detail || "",
      message: describeReject(result.code),
    };
    return {
      ok: false,
      code: result.code,
      detail: result.detail,
      message: lastAuthError.message,
      state: snapshot(),
    };
  }

  function startLoopback() {
    if (loopback) {
      return loopback;
    }
    loopback = http.createServer((req, res) => {
      const url = `http://127.0.0.1:${AUTH_LOOPBACK_PORT}${req.url || "/"}`;
      if (!String(req.url || "").startsWith("/auth/callback")) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      Promise.resolve(auth.handleCallback({ url }))
        .then((result) => {
          if (!result.ok) {
            lastAuthError = {
              code: result.code,
              detail: result.detail || "",
              message: describeReject(result.code),
            };
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<html><body>Studio auth failed: ${lastAuthError.message}</body></html>`);
            return;
          }
          lastAuthError = null;
          applyGithubMarket(result.data);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<html><body>Studio is signed in. You can return to the app.</body></html>");
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(err && err.message ? err.message : String(err));
        });
    });
    loopback.listen(AUTH_LOOPBACK_PORT, "127.0.0.1");
    return loopback;
  }

  function startOAuth(input) {
    const started = auth.startOAuth(input);
    if (!started.ok) {
      return failAuth(started);
    }
    startLoopback();
    lastAuthError = null;
    return {
      ok: true,
      url: started.data.url,
      state: started.data.state,
      redirectTo: started.data.redirectTo,
      supabaseCallback: started.data.supabaseCallback,
      opened: false,
      live: snapshot(),
    };
  }

  async function handleCallback(input) {
    const result = await auth.handleCallback(input);
    if (!result.ok) {
      return failAuth(result);
    }
    lastAuthError = null;
    applyGithubMarket(result.data);
    return { ok: true, session: result.data, state: snapshot() };
  }

  function connectSeat(provider) {
    if (typeof provider !== "string" || !provider.trim()) {
      return { ok: false, code: "UNKNOWN_SEAT", detail: "provider required", state: snapshot() };
    }
    const id = resolveProvider(provider);
    if (!isKnownProvider(id) && isImportableId(id)) {
      const imported = seats.registerImportedSeat(id);
      if (!imported.ok) {
        return { ok: false, code: imported.code, detail: imported.detail, state: snapshot() };
      }
    }
    const connected = seats.connect(id);
    if (!connected.ok) {
      return { ok: false, code: connected.code, detail: connected.detail, state: snapshot() };
    }
    const listed = market.get(id);
    if (listed.ok) {
      market.install(id);
      market.connect(id);
    }
    return {
      ok: true,
      connection: connected.data.connection || connected.data,
      ack: connected.data.ack,
      in_studio_only: connected.data.in_studio_only === true,
      mcp_attach: MCP_REL,
      provider: id,
      state: snapshot(),
    };
  }

  function importTeam() {
    const imported = seats.importRoster();
    if (!imported.ok) {
      return { ok: false, code: imported.code, detail: imported.detail, state: snapshot() };
    }
    return {
      ok: true,
      imported: imported.data,
      mcp_attach: MCP_REL,
      state: snapshot(),
    };
  }

  function createGate(input) {
    const created = hitl.createGate(input);
    if (!created.ok) {
      return { ok: false, code: created.code, detail: created.detail, state: snapshot() };
    }
    return { ok: true, gate: created.data.gate, state: snapshot() };
  }

  function resolveGate(input) {
    const resolved = hitl.resolveGate(input);
    if (!resolved.ok) {
      return { ok: false, code: resolved.code, detail: resolved.detail, state: snapshot() };
    }
    return { ok: true, gate: resolved.data.gate, state: snapshot() };
  }

  function close() {
    if (loopback) {
      loopback.close();
      loopback = null;
    }
  }

  return {
    auth,
    seats,
    hitl,
    market,
    modes,
    varDir,
    startOAuth,
    handleCallback,
    session: sessionPublic,
    signOut() {
      const result = auth.signOut();
      lastAuthError = null;
      return { ok: result.ok, data: result.data, state: snapshot() };
    },
    connectSeat,
    importTeam,
    dumpSeats,
    createGate,
    listNeedYou() {
      const listed = hitl.listNeedYou();
      return listed.ok
        ? { ok: true, gates: listed.data.gates, state: snapshot() }
        : { ok: false, code: listed.code, detail: listed.detail, state: snapshot() };
    },
    resolveGate,
    inbox() {
      return mapGithubInbox(sessionPublic().session);
    },
    browseMarket(query) {
      return market.browse(query);
    },
    installMarket(id) {
      return market.install(id);
    },
    connectMarket(id, extra) {
      return market.connect(id, extra);
    },
    revokeMarket(id) {
      return market.revoke(id);
    },
    listModes() {
      return modes.listModes();
    },
    enableMode(id) {
      return modes.enableMode(id);
    },
    activeMode() {
      return modes.activeMode();
    },
    mcpSurface() {
      return {
        ok: true,
        server: SERVER_INFO,
        protocol: PROTOCOL_VERSION,
        tools: TOOLS.slice(),
        providers: listProviders(),
      };
    },
    snapshot,
    startLoopback,
    close,
    describeReject,
  };
}

module.exports = {
  AUTH_REL,
  SEATS_REL,
  HITL_REL,
  MARKET_REL,
  MODES_REL,
  MCP_REL,
  GITHUB_REL,
  AUTH_LOOPBACK_PORT,
  AUTH_REDIRECT,
  TRAFFIC_LIGHT_POSITION,
  createStudioLive,
  githubTrayStatus,
  chromeSeats,
  mapGithubInbox,
  loadAuthEnv,
  describeReject,
};
