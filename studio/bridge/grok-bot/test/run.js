#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createGrokBridge,
  connectGrokSeat,
  importTeamRoster,
  listImportableSeats,
  listImported,
  uiContract,
  attachGrokMcp,
  advancedMcpAttachSpec,
  resolveGrokProvider,
  IMPORTABLE_IDS,
  SKIPPED_IDS,
  CONNECT_ACK,
  STRANGER_PATH,
  UI_CONTRACT_SCHEMA,
} = require("..");
const { createStudioSeats, HIGH_RISK_TOOLS, authorizeTool } = require("../../../seats");

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-grok-bot-"));
}

function fresh() {
  return createStudioSeats({ home: tmpHome() });
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

function assertConnectedGrok(connected, alias) {
  if (!connected.ok) {
    return connected;
  }
  const data = connected.data;
  const seat = data.seat;
  const connection = data.connection;
  if (
    !connection ||
    connection.provider !== "grok" ||
    connection.cutover !== true ||
    data.provider !== "grok" ||
    data.cutover !== true ||
    data.in_studio_only !== true ||
    data.presence !== "online" ||
    data.ack !== CONNECT_ACK ||
    !seat ||
    seat.id !== "grok" ||
    seat.presence !== "online" ||
    seat.cutover !== "attached" ||
    seat.in_studio_only !== true ||
    data.alias !== alias
  ) {
    return { ok: false, error: JSON.stringify(data) };
  }
  return { ok: true, data };
}

function cases() {
  const rows = [];

  rows.push(
    runCase("UI contract is click-first (not CLI)", () => {
      const contract = expectOk(uiContract());
      if (!contract.ok) {
        return contract;
      }
      if (contract.data.schema !== UI_CONTRACT_SCHEMA || contract.data.stranger_path !== STRANGER_PATH) {
        return { ok: false, error: JSON.stringify(contract.data) };
      }
      const apis = contract.data.actions.map((row) => row.api);
      if (!eq(apis, ["importTeamRoster", "connectGrokSeat", "listImportableSeats"])) {
        return { ok: false, error: apis.join(",") };
      }
      if (contract.data.alias.elon !== "grok" || contract.data.provider !== "grok") {
        return { ok: false, error: "alias" };
      }
      if (contract.data.on_connect.in_studio_only !== true || contract.data.on_connect.cutover !== "hard") {
        return { ok: false, error: "on_connect" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("README leads with UI contract, not CLI attach", () => {
      const text = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
      const headings = text.split("\n").filter((line) => line.startsWith("## "));
      if (!headings[0] || !/UI contract/i.test(headings[0])) {
        return { ok: false, error: `first H2 ${headings[0]}` };
      }
      const advancedAt = text.search(/^## Advanced/m);
      if (advancedAt < 0) {
        return { ok: false, error: "missing Advanced section" };
      }
      const primary = text.slice(0, advancedAt);
      if (/STUDIO_PROVIDER=/.test(primary) || /mcpServers/.test(primary) || /node studio\/mcp/.test(primary)) {
        return { ok: false, error: "CLI attach leaked into stranger README" };
      }
      const firstFence = primary.indexOf("```js");
      if (firstFence < 0) {
        return { ok: false, error: "missing UI JS fence" };
      }
      const fence = primary.slice(firstFence, primary.indexOf("```", firstFence + 5));
      if (!/importTeamRoster/.test(fence) || !/connectGrokSeat/.test(fence) || /STUDIO_PROVIDER/.test(fence)) {
        return { ok: false, error: "first fence is not the UI APIs" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("connectGrokSeat() measures seats.connect grok in-studio-only", () => {
      const studio = fresh();
      const connected = assertConnectedGrok(connectGrokSeat(studio), null);
      if (!connected.ok) {
        return connected;
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
    runCase("connectGrokSeat(elon) aliases to grok presence online in_studio_only", () => {
      const studio = fresh();
      const connected = assertConnectedGrok(connectGrokSeat(studio, "elon"), "elon");
      if (!connected.ok) {
        return connected;
      }
      const presence = expectOk(studio.presence.get("grok"));
      if (!presence.ok) {
        return presence;
      }
      if (presence.data.state !== "online" || presence.data.in_studio_only !== true) {
        return { ok: false, error: JSON.stringify(presence.data) };
      }
      const elonSeat = studio.seats.get("elon");
      if (elonSeat.ok) {
        return { ok: false, error: "elon must not become a second seat on connect" };
      }
      return { ok: true, extra: { connect_in_studio_only: 1 } };
    })
  );

  rows.push(
    runCase("createGrokBridge connect grok/elon + cutover rejects external/operator 1:1", () => {
      const bridge = createGrokBridge({ home: tmpHome() });
      const grok = assertConnectedGrok(bridge.connectGrokSeat("grok"), null);
      if (!grok.ok) {
        return grok;
      }
      const again = assertConnectedGrok(bridge.connectGrokSeat("elon"), "elon");
      if (!again.ok) {
        return again;
      }
      const external = expectReject(
        bridge.studio.emit({ from: "grok", dest: "slack:eng", body: "leak" }),
        "EXTERNAL_CHANNEL_FORBIDDEN"
      );
      if (!external.ok) {
        return external;
      }
      const operator = expectReject(
        bridge.studio.emit({ from: "grok", dest: "operator", body: "status ping" }),
        "OPERATOR_1TO1_FORBIDDEN"
      );
      if (!operator.ok) {
        return operator;
      }
      const luke = expectReject(
        bridge.studio.emit({ from: "grok", dest: "luke", body: "1:1" }),
        "OPERATOR_1TO1_FORBIDDEN"
      );
      if (!luke.ok) {
        return luke;
      }
      return {
        ok: true,
        extra: {
          connect_in_studio_only: 2,
          external_attempts: 1,
          external_rejects: 1,
          operator_1to1_attempts: 2,
          operator_1to1_rejects: 2,
          operator_1to1_leaks: 0,
        },
      };
    })
  );

  rows.push(
    runCase("importTeamRoster list matches roster; skipped stay out; no new grok bots", () => {
      const studio = fresh();
      const catalog = expectOk(listImportableSeats());
      if (!catalog.ok) {
        return catalog;
      }
      if (!eq(catalog.data.seats.map((row) => row.id), IMPORTABLE_IDS)) {
        return { ok: false, error: catalog.data.seats.map((row) => row.id).join(",") };
      }
      if (!eq(catalog.data.skipped.map((row) => row.id), SKIPPED_IDS)) {
        return { ok: false, error: "skipped mismatch" };
      }
      const imported = expectOk(importTeamRoster(studio));
      if (!imported.ok) {
        return imported;
      }
      if (!eq(imported.data.seats.map((row) => row.id), IMPORTABLE_IDS)) {
        return { ok: false, error: "import list mismatch" };
      }
      const listed = expectOk(listImported(studio));
      if (!listed.ok) {
        return listed;
      }
      if (!eq(listed.data.seats.map((row) => row.id), IMPORTABLE_IDS)) {
        return { ok: false, error: "listImported mismatch" };
      }
      const dumped = expectOk(studio.dump());
      if (!dumped.ok) {
        return dumped;
      }
      if (dumped.data.north_star.stranger_usable !== true || dumped.data.north_star.luke_fleet_only !== false) {
        return { ok: false, error: JSON.stringify(dumped.data.north_star) };
      }
      const grokSeats = dumped.data.seats.filter((seat) => seat.id === "grok" || seat.id === "elon");
      if (grokSeats.length !== 1 || grokSeats[0].id !== "grok") {
        return { ok: false, error: "created a new Grok Bot seat" };
      }
      return { ok: true, extra: { stranger_usable: 1 } };
    })
  );

  rows.push(
    runCase("imported team seat cutover rejects external/operator 1:1", () => {
      const studio = fresh();
      const imported = expectOk(importTeamRoster(studio));
      if (!imported.ok) {
        return imported;
      }
      const connected = expectOk(studio.connect("eng-lead"));
      if (!connected.ok) {
        return connected;
      }
      if (connected.data.in_studio_only !== true || connected.data.seat.presence !== "online") {
        return { ok: false, error: JSON.stringify(connected.data) };
      }
      const external = expectReject(
        studio.emit({ from: "eng-lead", dest: "group", body: "theater" }),
        "EXTERNAL_CHANNEL_FORBIDDEN"
      );
      if (!external.ok) {
        return external;
      }
      const operator = expectReject(
        studio.emit({ from: "eng-lead", dest: "owner", body: "ping" }),
        "OPERATOR_1TO1_FORBIDDEN"
      );
      if (!operator.ok) {
        return operator;
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
        },
      };
    })
  );

  rows.push(
    runCase("HITL still required after grok connect", () => {
      const studio = fresh();
      const connected = expectOk(connectGrokSeat(studio, "grok"));
      if (!connected.ok) {
        return connected;
      }
      if (!eq(connected.data.hitl_still, HIGH_RISK_TOOLS.slice())) {
        return { ok: false, error: `hitl_still ${connected.data.hitl_still}` };
      }
      for (const tool of HIGH_RISK_TOOLS) {
        const denied = expectReject(authorizeTool("grok", tool), "TOOL_REQUIRES_HITL");
        if (!denied.ok) {
          return denied;
        }
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("connectGrokSeat without studio fails closed (no silent CLI studio)", () => {
      const missing = expectReject(connectGrokSeat(), "BAD_STUDIO");
      if (!missing.ok) {
        return missing;
      }
      const unknown = expectReject(connectGrokSeat(fresh(), "claude"), "UNKNOWN_SEAT");
      if (!unknown.ok) {
        return unknown;
      }
      const skipped = expectReject(connectGrokSeat(fresh(), "eggbot"), "SKIPPED_ROSTER");
      if (!skipped.ok) {
        return skipped;
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("advanced MCP helper still calls seats.connect (not theater)", () => {
      const studio = fresh();
      const attached = expectOk(attachGrokMcp(studio, { id: "elon" }));
      if (!attached.ok) {
        return attached;
      }
      if (
        !attached.data.connection ||
        attached.data.connection.cutover !== true ||
        attached.data.connection.provider !== "grok" ||
        attached.data.spawned !== false ||
        attached.data.mcp.env.STUDIO_PROVIDER !== "grok"
      ) {
        return { ok: false, error: JSON.stringify(attached.data) };
      }
      const presence = expectOk(studio.presence.get("grok"));
      if (!presence.ok) {
        return presence;
      }
      if (presence.data.in_studio_only !== true) {
        return { ok: false, error: "advanced attach skipped seats.connect" };
      }
      const spec = expectOk(advancedMcpAttachSpec());
      if (!spec.ok) {
        return spec;
      }
      if (spec.data.stranger_path !== STRANGER_PATH) {
        return { ok: false, error: "advanced spec claimed to be the stranger path" };
      }
      const alias = expectOk(resolveGrokProvider("elon"));
      if (!alias.ok) {
        return alias;
      }
      if (alias.data.provider !== "grok") {
        return { ok: false, error: JSON.stringify(alias.data) };
      }
      return { ok: true, extra: { connect_in_studio_only: 1 } };
    })
  );

  rows.push(
    runCase("fresh seats dump stays stranger four-seat until import", () => {
      const studio = fresh();
      const dumped = expectOk(studio.dump());
      if (!dumped.ok) {
        return dumped;
      }
      if (dumped.data.seats.length !== 4 || dumped.data.north_star.stranger_usable !== true) {
        return { ok: false, error: "stranger dump" };
      }
      const empty = expectOk(listImported(studio));
      if (!empty.ok) {
        return empty;
      }
      if (empty.data.seats.length !== 0) {
        return { ok: false, error: "auto import" };
      }
      return { ok: true, extra: { stranger_usable: 1 } };
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
    module: "studio/bridge/grok-bot",
    instrument: "seats.connect",
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
    connect_in_studio_only: sumExtra(rows, "connect_in_studio_only"),
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
      `FAIL studio/bridge/grok-bot (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; operator_1to1_leaks=${lukeLeaks}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/bridge/grok-bot (measured; cases=${packet.cases} passed=${passed} failed=0; operator_1to1_leaks=0; wall_ms=${wallMs})\n`
  );
}

main();
