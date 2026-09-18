"use strict";

const { createStudioSeats } = require("../../seats");
const { ok, reject, CONNECT_ACK, IN_STUDIO_ONLY_LABEL, PRODUCT_LOCK } = require("./codes");
const { getProvider } = require("./providers");

function createSession(options) {
  const opts = options || {};
  const provider = getProvider(opts.provider);
  if (!provider) {
    return null;
  }
  const studio = opts.studio || createStudioSeats({ home: opts.home || null, clock: opts.clock || null });
  let connected = false;

  function connect() {
    const registered = studio.seats.register({
      id: provider.id,
      kind: "bot",
      label: provider.label,
    });
    if (!registered.ok) {
      return registered;
    }
    const attached = studio.seats.connect(provider.id);
    if (!attached.ok) {
      return attached;
    }
    connected = true;
    const seat = attached.data.seat;
    return ok({
      provider: { id: provider.id, label: provider.label },
      seat,
      ack: attached.data.ack || CONNECT_ACK,
      in_studio_only: Boolean(attached.data.in_studio_only || (seat && seat.in_studio_only)),
      cutover: seat ? seat.cutover : "attached",
      presence: seat ? seat.presence : "online",
      product_lock: PRODUCT_LOCK,
      in_studio_only_label: IN_STUDIO_ONLY_LABEL,
    });
  }

  function disconnect() {
    const existing = studio.seats.get(provider.id);
    if (!existing.ok) {
      connected = false;
      return existing;
    }
    const result = studio.seats.disconnect(provider.id);
    if (result.ok) {
      connected = false;
    }
    return result;
  }

  return {
    provider,
    studio,
    connect,
    disconnect,
    isConnected() {
      return connected;
    },
  };
}

function unknownProvider(id) {
  return reject(
    "UNKNOWN_PROVIDER",
    `provider must be one of claude|grok|cursor|codex|gemini|chatgpt (got ${id == null ? "missing" : JSON.stringify(id)})`
  );
}

module.exports = {
  createSession,
  unknownProvider,
};
