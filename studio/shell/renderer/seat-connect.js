"use strict";

(function attachSeatConnect(Studio) {
  const KNOWN_PROVIDERS = Object.freeze(["claude", "grok", "cursor", "codex", "gemini", "chatgpt"]);
  const CONNECT_ACK = "This seat works in Studio only while connected.";

  function assertNeverProvider(id) {
    throw new Error(`unhandled KnownProviderId: ${id}`);
  }

  function providerLabel(id) {
    switch (id) {
      case "claude":
        return "Claude";
      case "grok":
        return "Grok";
      case "cursor":
        return "Cursor";
      case "codex":
        return "Codex";
      case "gemini":
        return "Gemini";
      case "chatgpt":
        return "ChatGPT";
      default:
        return assertNeverProvider(id);
    }
  }

  function isKnownProvider(id) {
    return KNOWN_PROVIDERS.includes(id);
  }

  function providerRows() {
    return KNOWN_PROVIDERS.map((id) => ({ id, label: providerLabel(id) }));
  }

  function errorCopy(result) {
    if (!result) {
      return "Connect did nothing";
    }
    if (result.detail) {
      return result.detail;
    }
    if (result.code) {
      return result.code;
    }
    return "Seat connect failed";
  }

  function applyConnectResult(seats, result) {
    if (!result || result.ok !== true || !result.seat) {
      return {
        ok: false,
        seats,
        code: result && result.code ? result.code : "NO_OP",
        detail: errorCopy(result),
      };
    }
    const next = result.seat;
    const roster = Array.isArray(seats) ? seats.slice() : [];
    const idx = roster.findIndex((seat) => seat.id === next.id);
    if (idx >= 0) {
      roster[idx] = Object.assign({}, roster[idx], next);
    } else {
      const roomIdx = roster.findIndex((seat) => seat.id === "room:chat");
      if (roomIdx >= 0) {
        roster.splice(roomIdx, 0, next);
      } else {
        roster.push(next);
      }
    }
    return {
      ok: true,
      seats: roster,
      seat: roster.find((seat) => seat.id === next.id),
    };
  }

  Studio.seats = Studio.seats || {};
  Studio.seats.KNOWN_PROVIDERS = KNOWN_PROVIDERS;
  Studio.seats.CONNECT_ACK = CONNECT_ACK;
  Studio.seats.isKnownProvider = isKnownProvider;
  Studio.seats.providerLabel = providerLabel;
  Studio.seats.providerRows = providerRows;
  Studio.seats.errorCopy = errorCopy;
  Studio.seats.applyConnectResult = applyConnectResult;

  if (typeof module === "object" && module.exports) {
    module.exports = Studio.seats;
  }
})(globalThis.StudioShell = globalThis.StudioShell || {});
