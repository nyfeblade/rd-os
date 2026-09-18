"use strict";

/**
 * Add seat → pick provider → Connect click path.
 * Electron / preview / prove all call this. A no-op handler is a fail.
 */

const {
  CONNECT_ACK,
  KNOWN_PROVIDERS,
  createSeatsSession,
  isKnownProvider,
  resolveProvider,
  providers,
} = require("./seats-bridge");

function openAddSeat() {
  return {
    ok: true,
    phase: "open",
    kind: "seat",
    pick: true,
    id: null,
    title: "Add seat",
    copy: CONNECT_ACK,
    providers: providers(),
  };
}

function pickProvider(provider) {
  const id = resolveProvider(provider);
  if (!isKnownProvider(id)) {
    return {
      ok: false,
      phase: "pick",
      code: "UNKNOWN_PROVIDER",
      detail: `Pick a provider: ${KNOWN_PROVIDERS.join(", ")}.`,
      visible_error: true,
    };
  }
  const row = providers().find((item) => item.id === id);
  return {
    ok: true,
    phase: "pick",
    kind: "seat",
    pick: true,
    id,
    title: `Connect ${row.label}`,
    copy: CONNECT_ACK,
    providers: providers(),
  };
}

function runSeatConnectClick(options) {
  const opts = options || {};
  const session = opts.session || createSeatsSession(opts);

  if (opts.phase === "open") {
    return openAddSeat();
  }

  if (opts.phase === "pick") {
    return pickProvider(opts.provider);
  }

  const opened = openAddSeat();
  if (!opts.provider) {
    return {
      ok: false,
      phase: "connect",
      code: "BAD_ARGUMENT",
      detail: `Pick a provider: ${KNOWN_PROVIDERS.join(", ")}.`,
      visible_error: true,
      sheet: opened,
    };
  }

  const picked = pickProvider(opts.provider);
  if (!picked.ok) {
    return Object.assign({ phase: "connect", sheet: opened }, picked);
  }

  const connected = session.connect(picked.id);
  return Object.assign(
    {
      phase: "connect",
      visible_error: connected.ok !== true,
      sheet: picked,
      mutated: Boolean(connected.ok && connected.seat),
    },
    connected,
  );
}

module.exports = {
  CONNECT_ACK,
  KNOWN_PROVIDERS,
  createSeatsSession,
  openAddSeat,
  pickProvider,
  runSeatConnectClick,
};
