#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createStudioSeats,
  buildDemoDump,
  classifyDestination,
  authorizeTool,
  toolsAllowedFor,
  toolRequiresHitl,
  isToolAllowed,
  SEAT_IDS,
  BOT_SEAT_IDS,
  KNOWN_PROVIDERS,
  DEFAULT_TOOLS_ALLOWED,
  HIGH_RISK_TOOLS,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
} = require("..");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-seats-"));
}

function fresh(home) {
  return createStudioSeats({ home: home || tmpHome() });
}

function eq(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function runCase(name, fn) {
  try {
    const result = fn();
    if (result && result.ok === false && result.error) {
      return { name, ok: false, detail: result.error, extra: result.extra || {} };
    }
    return { name, ok: true, extra: (result && result.extra) || {} };
  } catch (err) {
    return { name, ok: false, detail: err && err.message ? err.message : String(err), extra: {} };
  }
}

function expectReject(result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `expected ${code}, got ${result && result.ok ? "ok" : result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true };
}

function expectOk(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true, data: result.data };
}

function cases() {
  const rows = [];

  rows.push(
    runCase("registry lists four general seats", () => {
      const listed = expectOk(fresh().seats.list());
      if (!listed.ok) {
        return listed;
      }
      const ids = listed.data.seats.map((seat) => seat.id);
      if (!eq(ids, SEAT_IDS)) {
        return { ok: false, error: `seats ${ids.join(",")}` };
      }
      const bots = listed.data.seats.filter((seat) => seat.kind === "bot").map((seat) => seat.id);
      if (!eq(bots, BOT_SEAT_IDS)) {
        return { ok: false, error: `bots ${bots.join(",")}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("presence starts offline", () => {
      const presence = expectOk(fresh().presence.list());
      if (!presence.ok) {
        return presence;
      }
      const live = presence.data.presence.filter((row) => row.state === "online");
      if (live.length !== 0 || presence.data.online_count !== 0) {
        return { ok: false, error: `online=${presence.data.online_count}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("connect bot auto-attaches cutover + in-studio-only ack", () => {
      const studio = fresh();
      const connected = expectOk(studio.seats.connect("grok"));
      if (!connected.ok) {
        return connected;
      }
      const seat = connected.data.seat;
      const connection = connected.data.connection;
      if (
        seat.presence !== "online" ||
        seat.cutover !== "attached" ||
        seat.in_studio_only !== true ||
        connected.data.ack !== "This seat works in Studio only while connected." ||
        !connection ||
        connection.provider !== "grok" ||
        connection.cutover !== true ||
        !connection.connected_at ||
        !eq(connection.tools_allowed, DEFAULT_TOOLS_ALLOWED.slice())
      ) {
        return { ok: false, error: JSON.stringify(connected.data) };
      }
      const presence = expectOk(studio.presence.get("grok"));
      if (!presence.ok) {
        return presence;
      }
      if (presence.data.state !== "online" || presence.data.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(presence.data) };
      }
      return { ok: true, extra: { connect_in_studio_only: 1 } };
    })
  );

  rows.push(
    runCase("connect(provider) registers known providers and returns connection record", () => {
      const studio = fresh();
      let connects = 0;
      for (const provider of KNOWN_PROVIDERS) {
        const connected = expectOk(studio.connect(provider));
        if (!connected.ok) {
          return connected;
        }
        const rec = connected.data.connection;
        if (
          !rec ||
          rec.provider !== provider ||
          rec.cutover !== true ||
          !rec.connected_at ||
          !eq(rec.tools_allowed, ["chat.emit", "board.read", "repo.read"]) ||
          connected.data.cutover !== true ||
          connected.data.in_studio_only !== true
        ) {
          return { ok: false, error: JSON.stringify(connected.data) };
        }
        const presence = expectOk(studio.presence.get(provider));
        if (!presence.ok) {
          return presence;
        }
        if (presence.data.in_studio_only !== true || presence.data.state !== "online") {
          return { ok: false, error: `${provider} presence ${JSON.stringify(presence.data)}` };
        }
        connects += 1;
      }
      if (connects !== 6) {
        return { ok: false, error: `connected ${connects}` };
      }
      return { ok: true, extra: { connect_in_studio_only: connects, connection_records: connects } };
    })
  );

  rows.push(
    runCase("bot↔bot room delivers when both connected", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      studio.seats.connect("claude");
      const sent = expectOk(studio.emit({ from: "grok", dest: "room:bots", body: "sync" }));
      if (!sent.ok) {
        return sent;
      }
      const messages = expectOk(studio.rooms.messages("room:bots"));
      if (!messages.ok) {
        return messages;
      }
      if (messages.data.messages.length !== 1 || messages.data.messages[0].from_seat !== "grok") {
        return { ok: false, error: `messages=${messages.data.messages.length}` };
      }
      return { ok: true, extra: { studio_room_delivers: 1 } };
    })
  );

  rows.push(
    runCase("connected bot → luke_1to1 is OPERATOR_1TO1_FORBIDDEN and does not store", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      const blocked = expectReject(studio.emit({ from: "grok", dest: "luke_1to1", body: "status ping Luke" }), "OPERATOR_1TO1_FORBIDDEN");
      if (!blocked.ok) {
        return blocked;
      }
      const messages = expectOk(studio.rooms.messages());
      if (!messages.ok) {
        return messages;
      }
      if (messages.data.messages.length !== 0) {
        return { ok: false, error: "luke path leaked a room message" };
      }
      return { ok: true, extra: { operator_1to1_attempts: 1, operator_1to1_rejects: 1, operator_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("operator/1:1 aliases all reject", () => {
      const studio = fresh();
      studio.seats.connect("claude");
      const dests = ["operator", "owner", "1:1", "dm:human", "luke", "dm:luke"];
      let rejects = 0;
      for (const dest of dests) {
        const result = studio.emit({ from: "claude", dest, body: "ack" });
        if (!result || result.ok !== false || result.code !== "OPERATOR_1TO1_FORBIDDEN") {
          return { ok: false, error: `${dest} → ${result && result.code}` };
        }
        rejects += 1;
      }
      return { ok: true, extra: { operator_1to1_attempts: dests.length, operator_1to1_rejects: rejects, operator_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("external group/dm/connector reject", () => {
      const studio = fresh();
      studio.seats.connect("cursor");
      const dests = ["group", "eng-hq", "slack:eng", "dm:elon", "connector:github:notify"];
      let rejects = 0;
      for (const dest of dests) {
        const result = studio.emit({ from: "cursor", dest, body: "noise" });
        if (!result || result.ok !== false || result.code !== "EXTERNAL_CHANNEL_FORBIDDEN") {
          return { ok: false, error: `${dest} → ${result && result.code}` };
        }
        rejects += 1;
      }
      return { ok: true, extra: { external_attempts: dests.length, external_rejects: rejects } };
    })
  );

  rows.push(
    runCase("github connector stub cannot open Luke/1:1", () => {
      const studio = fresh();
      studio.seats.connect("cursor");
      const blocked = expectReject(
        studio.connectors.speak({ connector: "github", from: "cursor", dest: "luke", body: "PR opened" }),
        "OPERATOR_1TO1_FORBIDDEN"
      );
      if (!blocked.ok) {
        return blocked;
      }
      return { ok: true, extra: { operator_1to1_attempts: 1, operator_1to1_rejects: 1, operator_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("human online may speak in Chat/Studio rooms, not Luke/1:1", () => {
      const studio = fresh();
      studio.seats.connect("human");
      const sent = expectOk(studio.emit({ from: "human", dest: "room:studio", body: "steer" }));
      if (!sent.ok) {
        return sent;
      }
      const blocked = expectReject(studio.emit({ from: "human", dest: "luke_1to1", body: "self ping" }), "OPERATOR_1TO1_FORBIDDEN");
      if (!blocked.ok) {
        return blocked;
      }
      return { ok: true, extra: { studio_room_delivers: 1, operator_1to1_attempts: 1, operator_1to1_rejects: 1, operator_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("offline bot cannot emit in-studio", () => {
      const studio = fresh();
      return expectReject(studio.emit({ from: "grok", dest: "room:bots", body: "early" }), "SEAT_DISCONNECTED");
    })
  );

  rows.push(
    runCase("connected+unattached bot (corrupt state) requires cutover", () => {
      const home = tmpHome();
      const statePath = path.join(home, "state.json");
      const studio0 = createStudioSeats({ home });
      studio0.seats.connect("grok");
      const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
      raw.seats.grok.cutover = "unattached";
      fs.writeFileSync(statePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
      const studio = createStudioSeats({ home });
      return expectReject(studio.emit({ from: "grok", dest: "room:bots", body: "should fail" }), "CUTOVER_REQUIRED");
    })
  );

  rows.push(
    runCase("cutover.detach is locked for bots", () => {
      const studio = fresh();
      studio.cutover.attach("grok");
      return expectReject(studio.cutover.detach("grok"), "CUTOVER_LOCKED");
    })
  );

  rows.push(
    runCase("disconnect goes offline; detach while online stays CUTOVER_LOCKED", () => {
      const studio = fresh();
      const connected = expectOk(studio.connect("claude"));
      if (!connected.ok) {
        return connected;
      }
      const locked = expectReject(studio.cutover.detach("claude"), "CUTOVER_LOCKED");
      if (!locked.ok) {
        return locked;
      }
      const disconnected = expectOk(studio.disconnect("claude"));
      if (!disconnected.ok) {
        return disconnected;
      }
      if (disconnected.data.seat.presence !== "offline") {
        return { ok: false, error: JSON.stringify(disconnected.data.seat) };
      }
      const blocked = expectReject(studio.emit({ from: "claude", dest: "room:bots", body: "after hangup" }), "SEAT_DISCONNECTED");
      if (!blocked.ok) {
        return blocked;
      }
      const stillLocked = expectReject(studio.cutover.detach("claude"), "CUTOVER_LOCKED");
      if (!stillLocked.ok) {
        return stillLocked;
      }
      const reconnected = expectOk(studio.connect("claude"));
      if (!reconnected.ok) {
        return reconnected;
      }
      if (reconnected.data.connection.cutover !== true || reconnected.data.seat.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(reconnected.data) };
      }
      return { ok: true, extra: { connect_in_studio_only: 1 } };
    })
  );

  rows.push(
    runCase("permission matrix defaults + high-risk always HITL", () => {
      if (!eq(toolsAllowedFor("claude"), ["chat.emit", "board.read", "repo.read"])) {
        return { ok: false, error: `default ${toolsAllowedFor("claude")}` };
      }
      if (!eq(toolsAllowedFor("chatgpt", { hitl: true }), ["chat.emit", "board.read", "repo.read", "merge", "deploy", "public"])) {
        return { ok: false, error: `hitl ${toolsAllowedFor("chatgpt", { hitl: true })}` };
      }
      for (const tool of HIGH_RISK_TOOLS) {
        if (toolRequiresHitl(tool) !== true || isToolAllowed("grok", tool) !== false) {
          return { ok: false, error: `${tool} leaked without HITL` };
        }
        const denied = expectReject(authorizeTool("grok", tool), "TOOL_REQUIRES_HITL");
        if (!denied.ok) {
          return denied;
        }
        const granted = expectOk(authorizeTool("grok", tool, { hitl: true }));
        if (!granted.ok) {
          return granted;
        }
        if (granted.data.hitl !== true) {
          return { ok: false, error: `${tool} missing hitl flag` };
        }
      }
      const emitGrant = expectOk(authorizeTool("cursor", "chat.emit"));
      if (!emitGrant.ok) {
        return emitGrant;
      }
      if (emitGrant.data.scope !== "room-only" || emitGrant.data.hitl !== false) {
        return { ok: false, error: JSON.stringify(emitGrant.data) };
      }
      return expectReject(authorizeTool("claude", "exfiltrate"), "TOOL_NOT_ALLOWED");
    })
  );

  rows.push(
    runCase("unknown dest fails closed (not a studio room)", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      return expectReject(studio.emit({ from: "grok", dest: "somewhere-else", body: "x" }), "EXTERNAL_CHANNEL_FORBIDDEN");
    })
  );

  rows.push(
    runCase("unknown room id after room: prefix", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      return expectReject(studio.emit({ from: "grok", dest: "room:missing", body: "x" }), "ROOM_NOT_FOUND");
    })
  );

  rows.push(
    runCase("cannot create a Luke-alias room", () => {
      const studio = fresh();
      return expectReject(studio.rooms.create({ id: "luke-dm", title: "Luke 1:1", kind: "human_bot" }), "OPERATOR_1TO1_FORBIDDEN");
    })
  );

  rows.push(
    runCase("cannot create a life-OS room", () => {
      const studio = fresh();
      return expectReject(
        studio.rooms.create({ id: "journal", title: "Personal journal", kind: "human_bot" }),
        "EXTERNAL_CHANNEL_FORBIDDEN"
      );
    })
  );

  rows.push(
    runCase("classifyDestination maps room and luke", () => {
      const room = classifyDestination("room:bots");
      const luke = classifyDestination("dm:luke");
      if (room.channel !== "studio_room" || room.room_id !== "room:bots") {
        return { ok: false, error: JSON.stringify(room) };
      }
      if (luke.channel !== "operator_1to1") {
        return { ok: false, error: JSON.stringify(luke) };
      }
      const owner = classifyDestination("dm:operator");
      if (owner.channel !== "operator_1to1") {
        return { ok: false, error: JSON.stringify(owner) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("dump shape is importable by other panes", () => {
      const studio = fresh();
      studio.seats.connect("human");
      studio.seats.connect("grok");
      const dumped = expectOk(studio.dump());
      if (!dumped.ok) {
        return dumped;
      }
      if (dumped.data.schema !== DUMP_SCHEMA || dumped.data.product_lock !== PRODUCT_LOCK) {
        return { ok: false, error: "dump header" };
      }
      if (!Array.isArray(dumped.data.seats) || dumped.data.seats.length !== 4) {
        return { ok: false, error: "dump seats" };
      }
      if (!dumped.data.cutover || dumped.data.cutover.legal_channel !== "studio_room") {
        return { ok: false, error: "dump cutover" };
      }
      if (
        !dumped.data.chat ||
        dumped.data.chat.pane !== "Chat" ||
        dumped.data.chat.pane_role !== "eng seats / rooms" ||
        dumped.data.chat.sibling_default !== "Board" ||
        dumped.data.chat.chrome !== "not-owned" ||
        dumped.data.chat.three_pane_always !== false ||
        dumped.data.chat.code !== "on-demand" ||
        !eq(dumped.data.chat.default_chrome, ["Chat", "Board"]) ||
        dumped.data.chat.trio
      ) {
        return { ok: false, error: "dump chat hints" };
      }
      if (
        !dumped.data.layout ||
        dumped.data.layout.three_pane_always !== false ||
        dumped.data.layout.code !== "on-demand" ||
        !eq(dumped.data.layout.default_chrome, ["Chat", "Board"])
      ) {
        return { ok: false, error: "dump layout lock" };
      }
      if (
        !dumped.data.eng ||
        dumped.data.eng.domain !== "eng" ||
        dumped.data.eng.life_os !== false ||
        dumped.data.eng.purpose !== "coding_agent_bot_bot" ||
        dumped.data.eng.multi_provider !== true ||
        dumped.data.eng.luke_fleet_only !== false
      ) {
        return { ok: false, error: "dump eng surface" };
      }
      if (
        !dumped.data.north_star ||
        dumped.data.north_star.audience !== "any_ai_developer_studio" ||
        dumped.data.north_star.providers !== "multi" ||
        dumped.data.north_star.stranger_usable !== true ||
        dumped.data.north_star.luke_fleet_only !== false
      ) {
        return { ok: false, error: "dump north star" };
      }
      if (
        !dumped.data.permissions ||
        !eq(dumped.data.permissions.default_tools_allowed, DEFAULT_TOOLS_ALLOWED.slice()) ||
        dumped.data.permissions.chat_emit_scope !== "room-only" ||
        !eq(dumped.data.permissions.high_risk, HIGH_RISK_TOOLS.slice()) ||
        dumped.data.permissions.high_risk_requires_hitl !== true ||
        !eq(dumped.data.permissions.providers, KNOWN_PROVIDERS.slice())
      ) {
        return { ok: false, error: "dump permissions" };
      }
      const grokTools = dumped.data.seats.find((seat) => seat.id === "grok");
      if (!grokTools || !eq(grokTools.tools_allowed, DEFAULT_TOOLS_ALLOWED.slice())) {
        return { ok: false, error: "dump tools_allowed" };
      }
      const grok = dumped.data.seats.find((seat) => seat.id === "grok");
      if (!grok || grok.surface !== "eng" || grok.agent !== "coding_agent") {
        return { ok: false, error: "coding_agent surface" };
      }
      const demo = buildDemoDump();
      if (demo.messages.length !== 2 || demo.online_count !== 3) {
        return { ok: false, error: "demo dump" };
      }
      if (demo.rooms.some((room) => room.id === "room:desk" || room.title === "Studio floor")) {
        return { ok: false, error: "Waiting/desk room language leaked" };
      }
      return { ok: true, extra: { stranger_usable: 1 } };
    })
  );

  rows.push(
    runCase("connect then external + operator 1:1 fail; dump stranger_usable stays true", () => {
      const studio = fresh();
      const connected = expectOk(studio.connect("chatgpt"));
      if (!connected.ok) {
        return connected;
      }
      if (connected.data.connection.cutover !== true || connected.data.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(connected.data.connection) };
      }
      const external = expectReject(
        studio.emit({ from: "chatgpt", dest: "slack:eng", body: "leak" }),
        "EXTERNAL_CHANNEL_FORBIDDEN"
      );
      if (!external.ok) {
        return external;
      }
      const operator = expectReject(
        studio.emit({ from: "chatgpt", dest: "operator", body: "status ping" }),
        "OPERATOR_1TO1_FORBIDDEN"
      );
      if (!operator.ok) {
        return operator;
      }
      const dumped = expectOk(studio.dump());
      if (!dumped.ok) {
        return dumped;
      }
      if (dumped.data.north_star.stranger_usable !== true || dumped.data.north_star.luke_fleet_only !== false) {
        return { ok: false, error: JSON.stringify(dumped.data.north_star) };
      }
      return {
        ok: true,
        extra: {
          connect_in_studio_only: 1,
          external_attempts: 1,
          external_rejects: 1,
          operator_1to1_attempts: 1,
          operator_1to1_rejects: 1,
          operator_1to1_leaks: 0,
          stranger_usable: 1,
        },
      };
    })
  );

  rows.push(
    runCase("persist reloads presence and messages", () => {
      const home = tmpHome();
      const a = createStudioSeats({ home });
      a.seats.connect("grok");
      a.seats.connect("claude");
      a.emit({ from: "grok", dest: "room:bots", body: "persisted" });
      const b = createStudioSeats({ home });
      const grok = expectOk(b.seats.get("grok"));
      if (!grok.ok) {
        return grok;
      }
      if (grok.data.seat.presence !== "online") {
        return { ok: false, error: "presence lost" };
      }
      const messages = expectOk(b.rooms.messages("bots"));
      if (!messages.ok) {
        return messages;
      }
      if (messages.data.messages.length !== 1 || messages.data.messages[0].body !== "persisted") {
        return { ok: false, error: "messages lost" };
      }
      return { ok: true, extra: { studio_room_delivers: 1 } };
    })
  );

  rows.push(
    runCase("unknown seat rejects", () => {
      return expectReject(fresh().seats.connect("elon"), "UNKNOWN_SEAT");
    })
  );

  rows.push(
    runCase("stranger can register another provider and emit in-studio", () => {
      const studio = fresh();
      const registered = expectOk(studio.seats.register({ id: "gemini", kind: "bot", label: "Gemini" }));
      if (!registered.ok) {
        return registered;
      }
      if (registered.data.seat.agent !== "coding_agent" || registered.data.seat.surface !== "eng") {
        return { ok: false, error: JSON.stringify(registered.data.seat) };
      }
      studio.seats.connect("gemini");
      const sent = expectOk(studio.emit({ from: "gemini", dest: "room:bots", body: "multi-provider bot↔bot" }));
      if (!sent.ok) {
        return sent;
      }
      const blocked = expectReject(studio.emit({ from: "gemini", dest: "owner", body: "ping" }), "OPERATOR_1TO1_FORBIDDEN");
      if (!blocked.ok) {
        return blocked;
      }
      return { ok: true, extra: { studio_room_delivers: 1, operator_1to1_attempts: 1, operator_1to1_rejects: 1, operator_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("cannot register an operator-alias seat", () => {
      return expectReject(fresh().seats.register({ id: "luke", kind: "bot" }), "OPERATOR_1TO1_FORBIDDEN");
    })
  );

  rows.push(
    runCase("away stays in-studio and may still emit", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      const away = expectOk(studio.presence.away("grok"));
      if (!away.ok) {
        return away;
      }
      if (away.data.seat.presence !== "away" || away.data.seat.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(away.data.seat) };
      }
      const sent = expectOk(studio.emit({ from: "grok", dest: "room:bots", body: "still in-studio" }));
      if (!sent.ok) {
        return sent;
      }
      return { ok: true, extra: { studio_room_delivers: 1 } };
    })
  );

  rows.push(
    runCase("seed rooms are eng surfaces (Bots / Agents / Studio)", () => {
      const rooms = expectOk(fresh().rooms.list());
      if (!rooms.ok) {
        return rooms;
      }
      const titles = rooms.data.rooms.map((room) => `${room.id}:${room.title}`).sort();
      if (!eq(titles, ["room:bots:Bots", "room:chat:Agents", "room:studio:Studio"])) {
        return { ok: false, error: titles.join(",") };
      }
      if (rooms.data.rooms.some((room) => room.surface !== "eng")) {
        return { ok: false, error: "room surface" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("life-OS dests fail closed", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      const dests = ["life-os", "journal", "personal", "family"];
      let rejects = 0;
      for (const dest of dests) {
        const result = studio.emit({ from: "grok", dest, body: "theater" });
        if (!result || result.ok !== false || result.code !== "EXTERNAL_CHANNEL_FORBIDDEN") {
          return { ok: false, error: `${dest} → ${result && result.code}` };
        }
        rejects += 1;
      }
      return { ok: true, extra: { external_attempts: dests.length, external_rejects: rejects } };
    })
  );

  rows.push(
    runCase("committed demo.dump.json matches generator", () => {
      const committed = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "fixtures", "demo.dump.json"), "utf8")
      );
      if (!eq(committed, buildDemoDump())) {
        return { ok: false, error: "fixtures/demo.dump.json drifted from buildDemoDump()" };
      }
      return { ok: true };
    })
  );

  return rows;
}

function sumExtra(rows, key) {
  return rows.reduce((total, row) => total + (Number(row.extra && row.extra[key]) || 0), 0);
}

function main() {
  const started = Date.now();
  const rows = cases();
  const passed = rows.filter((row) => row.ok).length;
  const failed = rows.filter((row) => !row.ok);
  const wallMs = Date.now() - started;
  const lukeAttempts = sumExtra(rows, "operator_1to1_attempts");
  const lukeRejects = sumExtra(rows, "operator_1to1_rejects");
  const lukeLeaks = sumExtra(rows, "operator_1to1_leaks");
  const packet = {
    ok: failed.length === 0 && lukeLeaks === 0 && lukeAttempts === lukeRejects,
    module: "studio/seats",
    instrument: "cutover.rules",
    measured_exit: failed.length === 0 ? 0 : 1,
    expect_exit: 0,
    wall_ms: wallMs,
    cases: rows.length,
    passed,
    failed: failed.length,
    operator_1to1_attempts: lukeAttempts,
    operator_1to1_rejects: lukeRejects,
    operator_1to1_leaks: lukeLeaks,
    external_attempts: sumExtra(rows, "external_attempts"),
    external_rejects: sumExtra(rows, "external_rejects"),
    studio_room_delivers: sumExtra(rows, "studio_room_delivers"),
    connect_in_studio_only: sumExtra(rows, "connect_in_studio_only"),
    connection_records: sumExtra(rows, "connection_records"),
    stranger_usable: sumExtra(rows, "stranger_usable"),
    clock_started: false,
    verdict: null,
    failures: failed.map((row) => ({ name: row.name, detail: row.detail })),
  };

  process.stdout.write(`${JSON.stringify(packet)}\n`);
  if (!packet.ok) {
    for (const row of failed) {
      process.stderr.write(`FAIL ${row.name}: ${row.detail}\n`);
    }
    process.stderr.write(
      `FAIL studio/seats cutover (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; operator_1to1_leaks=${lukeLeaks}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/seats cutover (measured; cases=${packet.cases} passed=${passed} failed=0; operator_1to1_leaks=0; wall_ms=${wallMs})\n`
  );
}

main();
