"use strict";

/**
 * Opt-in import of existing bot seats into createStudioSeats.
 * Does not seed the default stranger dump. Does not create Grok Bots.
 */

const fs = require("fs");
const path = require("path");
const { reject, ok, CONNECT_ACK, LEGAL_CHANNEL } = require("./codes");
const { HIGH_RISK_TOOLS } = require("./permissions");

const ROSTER_PATH = path.join(__dirname, "..", "fixtures", "eng-team.roster.json");
const ROSTER_SCHEMA = "studio.seats.roster/v1";
const TEAMS = Object.freeze(["eng", "design", "ops"]);
const SKIP_REASONS = Object.freeze(["not_a_studio_seat"]);
const GROK_PROVIDER = "grok";
const GROK_ALIASES = Object.freeze(["elon", "grok"]);

function assertNeverTeam(team) {
  throw new Error(`unhandled RosterTeam: ${team}`);
}

function assertNeverSkipReason(reason) {
  throw new Error(`unhandled RosterSkipReason: ${reason}`);
}

function assertNeverRosterId(id) {
  throw new Error(`unhandled ImportableSeatId: ${id}`);
}

function isTeam(value) {
  switch (value) {
    case "eng":
    case "design":
    case "ops":
      return true;
    default:
      return false;
  }
}

function isSkipReason(value) {
  switch (value) {
    case "not_a_studio_seat":
      return true;
    default:
      return false;
  }
}

function freezeCutover(raw) {
  const hitl = Object.freeze((raw.hitl || []).slice());
  return Object.freeze({
    protocol: raw.protocol,
    on_connect: raw.on_connect,
    legal_channel: raw.legal_channel,
    hitl,
  });
}

function freezeImportable(raw) {
  return Object.freeze({
    id: raw.id,
    label: raw.label,
    kind: raw.kind,
    team: raw.team,
    role: raw.role,
    provider: raw.provider,
    alias: raw.alias || null,
    cutover: freezeCutover(raw.cutover),
  });
}

function freezeSkipped(raw) {
  return Object.freeze({
    id: raw.id,
    label: raw.label,
    reason: raw.reason,
  });
}

function loadRosterDocument() {
  const parsed = JSON.parse(fs.readFileSync(ROSTER_PATH, "utf8"));
  if (!parsed || parsed.schema !== ROSTER_SCHEMA || !Array.isArray(parsed.importable) || !Array.isArray(parsed.skipped)) {
    throw new Error("eng-team.roster.json is not a studio.seats.roster/v1 document");
  }
  const seen = new Set();
  const importable = parsed.importable.map((row) => {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) {
      throw new Error(`invalid importable row ${row && row.id}`);
    }
    if (row.kind !== "bot") {
      throw new Error(`roster ${row.id} must be kind=bot`);
    }
    if (!isTeam(row.team)) {
      assertNeverTeam(row.team);
    }
    if (!row.cutover || row.cutover.protocol !== "hard" || row.cutover.on_connect !== "in_studio_only") {
      throw new Error(`roster ${row.id} must use hard in-studio-only cutover`);
    }
    if (row.cutover.legal_channel !== LEGAL_CHANNEL) {
      throw new Error(`roster ${row.id} legal_channel`);
    }
    const hitl = Array.isArray(row.cutover.hitl) ? row.cutover.hitl : [];
    if (JSON.stringify(hitl) !== JSON.stringify(HIGH_RISK_TOOLS.slice())) {
      throw new Error(`roster ${row.id} hitl must stay ${HIGH_RISK_TOOLS.join(",")}`);
    }
    seen.add(row.id);
    return freezeImportable(row);
  });
  const skipped = parsed.skipped.map((row) => {
    if (!row || typeof row.id !== "string") {
      throw new Error("invalid skipped row");
    }
    if (!isSkipReason(row.reason)) {
      assertNeverSkipReason(row.reason);
    }
    if (seen.has(row.id)) {
      throw new Error(`skipped id ${row.id} also importable`);
    }
    return freezeSkipped(row);
  });
  return Object.freeze({
    schema: ROSTER_SCHEMA,
    importable: Object.freeze(importable),
    skipped: Object.freeze(skipped),
  });
}

const DOCUMENT = loadRosterDocument();
const IMPORTABLE_ROSTER = DOCUMENT.importable;
const SKIPPED_ROSTER = DOCUMENT.skipped;
const IMPORTABLE_BY_ID = Object.freeze(Object.fromEntries(IMPORTABLE_ROSTER.map((row) => [row.id, row])));
const SKIPPED_BY_ID = Object.freeze(Object.fromEntries(SKIPPED_ROSTER.map((row) => [row.id, row])));
const IMPORTABLE_IDS = Object.freeze(IMPORTABLE_ROSTER.map((row) => row.id));
const SKIPPED_IDS = Object.freeze(SKIPPED_ROSTER.map((row) => row.id));

function isStudio(studio) {
  return Boolean(
    studio &&
      typeof studio === "object" &&
      typeof studio.connect === "function" &&
      typeof studio.importRoster === "function" &&
      typeof studio.listImported === "function" &&
      studio.seats &&
      typeof studio.seats.register === "function"
  );
}

function requireStudio(studio, apiName) {
  if (isStudio(studio)) {
    return null;
  }
  return reject("BAD_STUDIO", `${apiName}(studio) needs a createStudioSeats() instance from the UI`);
}

function seatIdFor(entry) {
  if (entry.alias) {
    return entry.alias;
  }
  return entry.id;
}

function importedRow(entry) {
  const seatId = seatIdFor(entry);
  return {
    id: entry.id,
    label: entry.label,
    kind: entry.kind,
    team: entry.team,
    role: entry.role,
    provider: entry.provider,
    seat_id: seatId,
    aliased: Boolean(entry.alias) && entry.alias !== entry.id,
    cutover: {
      protocol: entry.cutover.protocol,
      on_connect: entry.cutover.on_connect,
      legal_channel: entry.cutover.legal_channel,
      hitl: entry.cutover.hitl.slice(),
      ack: CONNECT_ACK,
    },
  };
}

function listImportableSeats() {
  return ok({
    seats: IMPORTABLE_ROSTER.map((entry) => importedRow(entry)),
    skipped: SKIPPED_ROSTER.map((row) => ({ id: row.id, label: row.label, reason: row.reason })),
    count: IMPORTABLE_ROSTER.length,
  });
}

function listImportedFromState(state) {
  const ids = Array.isArray(state && state.imported_ids) ? state.imported_ids : [];
  const seats = [];
  for (const id of ids) {
    const entry = IMPORTABLE_BY_ID[id];
    if (!entry) {
      continue;
    }
    seats.push(importedRow(entry));
  }
  return ok({
    seats,
    skipped: SKIPPED_ROSTER.map((row) => ({ id: row.id, label: row.label, reason: row.reason })),
    count: seats.length,
  });
}

function applyImport(registerSeat, state) {
  if (!state.imported_ids) {
    state.imported_ids = [];
  }
  for (const entry of IMPORTABLE_ROSTER) {
    if (!entry.alias) {
      const registered = registerSeat({
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
      });
      if (!registered.ok) {
        return registered;
      }
    }
    if (!state.imported_ids.includes(entry.id)) {
      state.imported_ids.push(entry.id);
    }
  }
  return listImportedFromState(state);
}

function registerImportedSeat(registerSeat, state, id) {
  const skipped = SKIPPED_BY_ID[id];
  if (skipped) {
    return reject("SKIPPED_ROSTER", `${skipped.label} is not imported as a Studio seat`);
  }
  const entry = IMPORTABLE_BY_ID[id];
  if (!entry) {
    return reject("UNKNOWN_SEAT", `unknown roster id: ${id}`);
  }
  if (!state.imported_ids) {
    state.imported_ids = [];
  }
  if (!entry.alias) {
    const registered = registerSeat({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
    });
    if (!registered.ok) {
      return registered;
    }
  }
  if (!state.imported_ids.includes(entry.id)) {
    state.imported_ids.push(entry.id);
  }
  return ok({ seat: importedRow(entry) });
}

function importRoster(studio) {
  const bad = requireStudio(studio, "importRoster");
  if (bad) {
    return bad;
  }
  return studio.importRoster();
}

function listImported(studio) {
  const bad = requireStudio(studio, "listImported");
  if (bad) {
    return bad;
  }
  return studio.listImported();
}

function resolveGrokProvider(id) {
  if (id == null || id === "") {
    return ok({ provider: GROK_PROVIDER, alias: null });
  }
  const slug = String(id).trim();
  switch (slug) {
    case "grok":
      return ok({ provider: GROK_PROVIDER, alias: null });
    case "elon":
      return ok({ provider: GROK_PROVIDER, alias: "elon" });
    default:
      if (SKIPPED_BY_ID[slug]) {
        return reject("SKIPPED_ROSTER", `${SKIPPED_BY_ID[slug].label} is not a Grok Studio seat`);
      }
      return reject("UNKNOWN_SEAT", `connectGrokSeat accepts grok|elon (got ${JSON.stringify(slug)})`);
  }
}

function isImportableId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(IMPORTABLE_BY_ID, id);
}

function isSkippedId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(SKIPPED_BY_ID, id);
}

function rosterEntry(id) {
  return IMPORTABLE_BY_ID[id] || null;
}

function teamOf(id) {
  const entry = IMPORTABLE_BY_ID[id];
  if (!entry) {
    return assertNeverRosterId(id);
  }
  switch (entry.team) {
    case "eng":
    case "design":
    case "ops":
      return entry.team;
    default:
      return assertNeverTeam(entry.team);
  }
}

module.exports = {
  ROSTER_PATH,
  ROSTER_SCHEMA,
  TEAMS,
  SKIP_REASONS,
  GROK_PROVIDER,
  GROK_ALIASES,
  IMPORTABLE_ROSTER,
  SKIPPED_ROSTER,
  IMPORTABLE_IDS,
  SKIPPED_IDS,
  assertNeverTeam,
  assertNeverSkipReason,
  assertNeverRosterId,
  isTeam,
  isSkipReason,
  isStudio,
  isImportableId,
  isSkippedId,
  seatIdFor,
  importedRow,
  listImportableSeats,
  listImportedFromState,
  applyImport,
  registerImportedSeat,
  importRoster,
  listImported,
  resolveGrokProvider,
  rosterEntry,
  teamOf,
};
