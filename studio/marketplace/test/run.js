#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createStudioMarketplace,
  parseCatalog,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
  EMPTY_INSTALLED,
  NO_MATCHES,
  CONNECT_ACK,
  LEGAL_CHANNEL,
  CUTOVER_LABEL,
} = require("..");

const P0_IDS = [
  "claude",
  "grok",
  "cursor",
  "codex",
  "gemini",
  "chatgpt",
  "github",
  "slack",
  "studio-mcp",
];

const SEAT_IDS = ["claude", "grok", "cursor", "codex", "gemini", "chatgpt"];
const CONNECTOR_TAB_IDS = ["github", "slack", "studio-mcp"];

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-marketplace-"));
}

function fresh(home) {
  return createStudioMarketplace({ home: home || tmpHome() });
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
    runCase("catalog P0 ids are seats + github/slack + studio-mcp", () => {
      const listed = expectOk(fresh().catalog());
      if (!listed.ok) {
        return listed;
      }
      if (!eq(listed.data.ids, P0_IDS)) {
        return { ok: false, error: `ids ${listed.data.ids.join(",")}` };
      }
      if (listed.data.product_lock !== PRODUCT_LOCK) {
        return { ok: false, error: "product_lock" };
      }
      if (!eq(listed.data.tabs, ["connectors", "seats", "modes"])) {
        return { ok: false, error: "tabs" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("catalog omits life-OS and later connectors", () => {
      const listed = expectOk(fresh().list());
      if (!listed.ok) {
        return listed;
      }
      const ids = listed.data.entries.map((entry) => entry.id);
      const banned = ["linear", "sentry", "vercel", "calendar", "journal", "life-os", "waiting"];
      const hit = banned.filter((id) => ids.includes(id));
      if (hit.length !== 0) {
        return { ok: false, error: `leaked ${hit.join(",")}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("github starts available", () => {
      const got = expectOk(fresh().get("github"));
      if (!got.ok) {
        return got;
      }
      if (got.data.entry.state !== "available" || got.data.entry.cta !== "Connect") {
        return { ok: false, error: JSON.stringify(got.data.entry) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("github install → needs_auth → connect live → revoke available", () => {
      const market = fresh();
      const installed = expectOk(market.install("github"));
      if (!installed.ok) {
        return installed;
      }
      if (installed.data.entry.state !== "needs_auth" || installed.data.entry.cta !== "Fix auth") {
        return { ok: false, error: `install ${installed.data.entry.state}` };
      }
      const live = expectOk(market.connect("github"));
      if (!live.ok) {
        return live;
      }
      if (live.data.entry.state !== "live") {
        return { ok: false, error: `connect ${live.data.entry.state}` };
      }
      const revoked = expectOk(market.revoke("github"));
      if (!revoked.ok) {
        return revoked;
      }
      if (revoked.data.entry.state !== "available") {
        return { ok: false, error: `revoke ${revoked.data.entry.state}` };
      }
      return { ok: true, extra: { lifecycle: 1 } };
    })
  );

  rows.push(
    runCase("studio-mcp install → live → revoke available", () => {
      const market = fresh();
      const installed = expectOk(market.install("studio-mcp"));
      if (!installed.ok) {
        return installed;
      }
      if (installed.data.entry.state !== "live") {
        return { ok: false, error: `install ${installed.data.entry.state}` };
      }
      const revoked = expectOk(market.revoke("studio-mcp"));
      if (!revoked.ok) {
        return revoked;
      }
      if (revoked.data.entry.state !== "available") {
        return { ok: false, error: `revoke ${revoked.data.entry.state}` };
      }
      return { ok: true, extra: { lifecycle: 1 } };
    })
  );

  rows.push(
    runCase("claude install → needs_auth → connect live → revoke available", () => {
      const market = fresh();
      const installed = expectOk(market.install("claude"));
      if (!installed.ok) {
        return installed;
      }
      if (installed.data.entry.state !== "needs_auth") {
        return { ok: false, error: `install ${installed.data.entry.state}` };
      }
      const live = expectOk(market.connect("claude"));
      if (!live.ok) {
        return live;
      }
      if (live.data.entry.state !== "live") {
        return { ok: false, error: `connect ${live.data.entry.state}` };
      }
      const revoked = expectOk(market.revoke("claude"));
      if (!revoked.ok) {
        return revoked;
      }
      if (revoked.data.entry.state !== "available") {
        return { ok: false, error: `revoke ${revoked.data.entry.state}` };
      }
      return { ok: true, extra: { lifecycle: 1 } };
    })
  );

  rows.push(
    runCase("persist proves install→live→revoke across reload", () => {
      const home = tmpHome();
      const a = createStudioMarketplace({ home });
      const installed = expectOk(a.install("github"));
      if (!installed.ok) {
        return installed;
      }
      if (installed.data.entry.state !== "needs_auth") {
        return { ok: false, error: "install did not persist needs_auth" };
      }
      const live = expectOk(a.connect("github"));
      if (!live.ok) {
        return live;
      }
      const b = createStudioMarketplace({ home });
      const afterConnect = expectOk(b.get("github"));
      if (!afterConnect.ok) {
        return afterConnect;
      }
      if (afterConnect.data.entry.state !== "live") {
        return { ok: false, error: `reload after connect ${afterConnect.data.entry.state}` };
      }
      const revoked = expectOk(b.revoke("github"));
      if (!revoked.ok) {
        return revoked;
      }
      const c = createStudioMarketplace({ home });
      const afterRevoke = expectOk(c.get("github"));
      if (!afterRevoke.ok) {
        return afterRevoke;
      }
      if (afterRevoke.data.entry.state !== "available") {
        return { ok: false, error: `reload after revoke ${afterRevoke.data.entry.state}` };
      }
      return { ok: true, extra: { lifecycle: 1 } };
    })
  );

  rows.push(
    runCase("all six seat providers connect to live", () => {
      const market = fresh();
      for (const id of SEAT_IDS) {
        const live = expectOk(market.connect(id));
        if (!live.ok) {
          return live;
        }
        if (live.data.entry.state !== "live" || live.data.entry.kind !== "seat") {
          return { ok: false, error: `${id} ${live.data.entry.state}` };
        }
        if (live.data.entry.cutover !== "in-studio-only") {
          return { ok: false, error: `${id} cutover` };
        }
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("connect error then recover to live", () => {
      const market = fresh();
      market.install("slack");
      const failed = expectOk(market.connect("slack", { error: "oauth_denied" }));
      if (!failed.ok) {
        return failed;
      }
      if (failed.data.entry.state !== "error" || failed.data.entry.error !== "oauth_denied") {
        return { ok: false, error: JSON.stringify(failed.data.entry) };
      }
      if (failed.data.entry.cta !== "Re-auth") {
        return { ok: false, error: `cta ${failed.data.entry.cta}` };
      }
      const live = expectOk(market.connect("slack"));
      if (!live.ok) {
        return live;
      }
      if (live.data.entry.state !== "live" || live.data.entry.error !== null) {
        return { ok: false, error: JSON.stringify(live.data.entry) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("unknown entry rejects", () => {
      return expectReject(fresh().install("calendar"), "UNKNOWN_ENTRY");
    })
  );

  rows.push(
    runCase("unknown tab rejects", () => {
      return expectReject(fresh().browse({ tab: "lifestyle" }), "UNKNOWN_TAB");
    })
  );

  rows.push(
    runCase("install/connect/revoke are idempotent", () => {
      const market = fresh();
      market.install("studio-mcp");
      const again = expectOk(market.install("studio-mcp"));
      if (!again.ok) {
        return again;
      }
      if (again.data.entry.state !== "live") {
        return { ok: false, error: "second install" };
      }
      market.connect("studio-mcp");
      const still = expectOk(market.connect("studio-mcp"));
      if (!still.ok) {
        return still;
      }
      if (still.data.entry.state !== "live") {
        return { ok: false, error: "second connect" };
      }
      market.revoke("studio-mcp");
      const revoked = expectOk(market.revoke("studio-mcp"));
      if (!revoked.ok) {
        return revoked;
      }
      if (revoked.data.entry.state !== "available") {
        return { ok: false, error: "second revoke" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("browse tabs match MARKETPLACE IA", () => {
      const market = fresh();
      const seats = expectOk(market.browse({ tab: "seats" }));
      if (!seats.ok) {
        return seats;
      }
      const seatIds = seats.data.entries.map((entry) => entry.id);
      if (!eq(seatIds, SEAT_IDS)) {
        return { ok: false, error: `seats ${seatIds.join(",")}` };
      }
      const connectors = expectOk(market.browse({ tab: "connectors" }));
      if (!connectors.ok) {
        return connectors;
      }
      const connectorIds = connectors.data.entries.map((entry) => entry.id);
      if (!eq(connectorIds, CONNECTOR_TAB_IDS)) {
        return { ok: false, error: `connectors ${connectorIds.join(",")}` };
      }
      const modes = expectOk(market.browse({ tab: "modes" }));
      if (!modes.ok) {
        return modes;
      }
      if (modes.data.entries.length !== 0) {
        return { ok: false, error: "modes P0 must be empty" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("empty installed copy", () => {
      const empty = expectOk(fresh().installed());
      if (!empty.ok) {
        return empty;
      }
      if (empty.data.empty !== "empty_installed" || empty.data.empty_copy !== EMPTY_INSTALLED) {
        return { ok: false, error: JSON.stringify(empty.data) };
      }
      if (empty.data.empty_copy !== "Nothing installed — connect GitHub or Slack to start") {
        return { ok: false, error: empty.data.empty_copy };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("browse no matches asks to clear filters", () => {
      const result = expectOk(fresh().browse({ q: "life-os-journal" }));
      if (!result.ok) {
        return result;
      }
      if (result.data.empty !== "no_matches" || result.data.empty_copy !== NO_MATCHES) {
        return { ok: false, error: JSON.stringify(result.data) };
      }
      if (result.data.hint !== "clear filters") {
        return { ok: false, error: `hint ${result.data.hint}` };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("seat detail states cutover and studio_room", () => {
      const got = expectOk(fresh().get("grok"));
      if (!got.ok) {
        return got;
      }
      const does = got.data.entry.does;
      if (!does.includes("studio_room") || !does.includes("Studio only")) {
        return { ok: false, error: does };
      }
      if (got.data.entry.tools_pointer !== "studio/seats/CUTOVER.md") {
        return { ok: false, error: got.data.entry.tools_pointer };
      }
      if (got.data.entry.cta !== "Add seat") {
        return { ok: false, error: got.data.entry.cta };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("github detail points at the two-way tool matrix", () => {
      const got = expectOk(fresh().get("github"));
      if (!got.ok) {
        return got;
      }
      if (got.data.entry.tools_pointer !== "studio/connectors/CATALOG.md#two-way-p0-wire") {
        return { ok: false, error: got.data.entry.tools_pointer };
      }
      if (got.data.entry.two_way !== true || got.data.entry.hitl !== "high-risk") {
        return { ok: false, error: "badges" };
      }
      if (!got.data.entry.does.includes("create_issue_comment")) {
        return { ok: false, error: got.data.entry.does };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("connect does not persist secrets", () => {
      const home = tmpHome();
      const market = createStudioMarketplace({ home });
      market.connect("github", { secret: "ghp_should_not_land", token: "tok", error: undefined });
      const raw = fs.readFileSync(path.join(home, "state.json"), "utf8");
      if (raw.includes("ghp_should_not_land") || raw.includes("tok") || raw.includes("secret")) {
        return { ok: false, error: raw };
      }
      const parsed = JSON.parse(raw);
      const keys = Object.keys(parsed.installs.github).sort();
      if (!eq(keys, ["error", "installed_at", "state", "updated_at"])) {
        return { ok: false, error: keys.join(",") };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("dump is importable and does not own chrome", () => {
      const dumped = expectOk(fresh().dump());
      if (!dumped.ok) {
        return dumped;
      }
      if (dumped.data.schema !== DUMP_SCHEMA || dumped.data.product_lock !== PRODUCT_LOCK) {
        return { ok: false, error: "dump header" };
      }
      if (dumped.data.chrome !== "not-owned" || dumped.data.legal_channel !== LEGAL_CHANNEL) {
        return { ok: false, error: "chrome/channel" };
      }
      if (dumped.data.connect_ack !== CONNECT_ACK || dumped.data.cutover_label !== CUTOVER_LABEL) {
        return { ok: false, error: "cutover copy" };
      }
      if (dumped.data.installed_count !== 0 || dumped.data.entries.length !== 9) {
        return { ok: false, error: "counts" };
      }
      if (!eq(dumped.data.not, [
        "grok_bot_chrome",
        "life_os_connectors_p0",
        "waiting_table",
        "generic_agent_mall",
      ])) {
        return { ok: false, error: "not" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("parseCatalog rejects a life-OS id", () => {
      const parsed = parseCatalog({
        schema: "studio.marketplace.catalog/v1",
        product_lock: PRODUCT_LOCK,
        not: [
          "grok_bot_chrome",
          "life_os_connectors_p0",
          "waiting_table",
          "generic_agent_mall",
        ],
        tabs: ["connectors", "seats", "modes"],
        entries: [
          {
            id: "calendar",
            kind: "connector",
            tab: "connectors",
            tier: "p0",
            name: "Calendar",
            job: "life",
            does: "no",
            auth_required: false,
            cost_class: "lean",
            two_way: false,
            hitl: null,
            tools_pointer: "nope",
          },
        ],
      });
      return expectReject(parsed, "LIFE_OS_FORBIDDEN");
    })
  );

  rows.push(
    runCase("low-token browse keeps lean entries only", () => {
      const result = expectOk(fresh().browse({ low_token: true }));
      if (!result.ok) {
        return result;
      }
      const ids = result.data.entries.map((entry) => entry.id);
      if (!eq(ids, ["github", "slack", "studio-mcp"])) {
        return { ok: false, error: ids.join(",") };
      }
      if (result.data.entries.some((entry) => entry.cost_class !== "lean")) {
        return { ok: false, error: "non-lean leaked" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("corrupt state.json fails closed", () => {
      const home = tmpHome();
      fs.writeFileSync(path.join(home, "state.json"), "{not-json", "utf8");
      const market = createStudioMarketplace({ home });
      return expectReject(market.install("github"), "STORE_CORRUPT");
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
  const packet = {
    ok: failed.length === 0,
    module: "studio/marketplace",
    instrument: "install.connect.revoke",
    measured_exit: failed.length === 0 ? 0 : 1,
    expect_exit: 0,
    wall_ms: wallMs,
    cases: rows.length,
    passed,
    failed: failed.length,
    lifecycle: sumExtra(rows, "lifecycle"),
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
      `FAIL studio/marketplace (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/marketplace (measured; cases=${packet.cases} passed=${passed} failed=0; wall_ms=${wallMs})\n`
  );
}

main();
