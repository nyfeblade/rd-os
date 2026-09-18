#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createStudioSeats,
  buildDemoDump,
  classifyDestination,
  SEAT_IDS,
  BOT_SEAT_IDS,
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
      if (
        seat.presence !== "online" ||
        seat.cutover !== "attached" ||
        seat.in_studio_only !== true ||
        connected.data.ack !== "This seat works in Studio only while connected."
      ) {
        return { ok: false, error: JSON.stringify(connected.data) };
      }
      return { ok: true };
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
    runCase("connected bot → luke_1to1 is LUKE_1TO1_FORBIDDEN and does not store", () => {
      const studio = fresh();
      studio.seats.connect("grok");
      const blocked = expectReject(studio.emit({ from: "grok", dest: "luke_1to1", body: "status ping Luke" }), "LUKE_1TO1_FORBIDDEN");
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
      return { ok: true, extra: { luke_1to1_attempts: 1, luke_1to1_rejects: 1, luke_1to1_leaks: 0 } };
    })
  );

  rows.push(
    runCase("luke aliases all reject", () => {
      const studio = fresh();
      studio.seats.connect("claude");
      const dests = ["luke", "1:1", "dm:luke", "grok:luke", "external:luke"];
      let rejects = 0;
      for (const dest of dests) {
        const result = studio.emit({ from: "claude", dest, body: "ack" });
        if (!result || result.ok !== false || result.code !== "LUKE_1TO1_FORBIDDEN") {
          return { ok: false, error: `${dest} → ${result && result.code}` };
        }
        rejects += 1;
      }
      return { ok: true, extra: { luke_1to1_attempts: dests.length, luke_1to1_rejects: rejects, luke_1to1_leaks: 0 } };
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
        "LUKE_1TO1_FORBIDDEN"
      );
      if (!blocked.ok) {
        return blocked;
      }
      return { ok: true, extra: { luke_1to1_attempts: 1, luke_1to1_rejects: 1, luke_1to1_leaks: 0 } };
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
      const blocked = expectReject(studio.emit({ from: "human", dest: "luke_1to1", body: "self ping" }), "LUKE_1TO1_FORBIDDEN");
      if (!blocked.ok) {
        return blocked;
      }
      return { ok: true, extra: { studio_room_delivers: 1, luke_1to1_attempts: 1, luke_1to1_rejects: 1, luke_1to1_leaks: 0 } };
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
      return expectReject(studio.rooms.create({ id: "luke-dm", title: "Luke 1:1", kind: "human_bot" }), "LUKE_1TO1_FORBIDDEN");
    })
  );

  rows.push(
    runCase("classifyDestination maps room and luke", () => {
      const room = classifyDestination("room:bots");
      const luke = classifyDestination("dm:luke");
      if (room.channel !== "studio_room" || room.room_id !== "room:bots") {
        return { ok: false, error: JSON.stringify(room) };
      }
      if (luke.channel !== "luke_1to1") {
        return { ok: false, error: JSON.stringify(luke) };
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
      const demo = buildDemoDump();
      if (demo.messages.length !== 2 || demo.online_count !== 3) {
        return { ok: false, error: "demo dump" };
      }
      if (demo.rooms.some((room) => room.id === "room:desk" || room.title === "Studio floor")) {
        return { ok: false, error: "Waiting/desk room language leaked" };
      }
      return { ok: true };
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
      const sent = expectOk(studio.emit({ from: "grok", dest: "room:bots", body: "still in Chat" }));
      if (!sent.ok) {
        return sent;
      }
      return { ok: true, extra: { studio_room_delivers: 1 } };
    })
  );

  rows.push(
    runCase("seed rooms are Chat list rows (Bots / Chat / Studio)", () => {
      const rooms = expectOk(fresh().rooms.list());
      if (!rooms.ok) {
        return rooms;
      }
      const titles = rooms.data.rooms.map((room) => `${room.id}:${room.title}`).sort();
      if (!eq(titles, ["room:bots:Bots", "room:chat:Chat", "room:studio:Studio"])) {
        return { ok: false, error: titles.join(",") };
      }
      return { ok: true };
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
  const lukeAttempts = sumExtra(rows, "luke_1to1_attempts");
  const lukeRejects = sumExtra(rows, "luke_1to1_rejects");
  const lukeLeaks = sumExtra(rows, "luke_1to1_leaks");
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
    luke_1to1_attempts: lukeAttempts,
    luke_1to1_rejects: lukeRejects,
    luke_1to1_leaks: lukeLeaks,
    external_attempts: sumExtra(rows, "external_attempts"),
    external_rejects: sumExtra(rows, "external_rejects"),
    studio_room_delivers: sumExtra(rows, "studio_room_delivers"),
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
      `FAIL studio/seats cutover (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; luke_1to1_leaks=${lukeLeaks}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/seats cutover (measured; cases=${packet.cases} passed=${passed} failed=0; luke_1to1_leaks=0; wall_ms=${wallMs})\n`
  );
}

main();
