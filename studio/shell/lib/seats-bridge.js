"use strict";

/**
 * Consume-only studio/seats bridge. Shell owns chrome; seats owns register,
 * connect, cutover.attach, and presence. Do not invent a local roster.
 */

const path = require("node:path");
const {
  createStudioSeats,
  KNOWN_PROVIDERS,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  seatLabelOf,
  seatKindOf,
  isKnownProvider,
} = require("../../seats");

const SEATS_REL = "studio/seats";

function assertNeverProvider(id) {
  throw new Error(`unhandled KnownProviderId: ${id}`);
}

function secretKeysFor(provider) {
  switch (provider) {
    case "claude":
      return Object.freeze(["ANTHROPIC_API_KEY"]);
    case "grok":
      return Object.freeze(["XAI_API_KEY"]);
    case "cursor":
      return Object.freeze(["CURSOR_API_KEY"]);
    case "codex":
      return Object.freeze(["OPENAI_API_KEY"]);
    case "gemini":
      return Object.freeze(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
    case "chatgpt":
      return Object.freeze(["OPENAI_API_KEY"]);
    default:
      return assertNeverProvider(provider);
  }
}

function envHasSecret(env, keys) {
  const source = env || {};
  return keys.some((key) => {
    const value = source[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function defaultHome() {
  if (process.env.STUDIO_HOME) {
    return path.join(path.resolve(process.env.STUDIO_HOME), "seats");
  }
  return path.resolve(__dirname, "..", "var", "seats");
}

function reject(code, detail, extra) {
  return Object.assign(
    {
      ok: false,
      code,
      detail,
      visible_error: true,
    },
    extra || {},
  );
}

function unknownProvider(id) {
  return reject(
    "UNKNOWN_PROVIDER",
    `provider must be one of ${KNOWN_PROVIDERS.join("|")} (got ${id == null ? "missing" : JSON.stringify(id)})`,
  );
}

function missingSecret(provider, env) {
  if (!isKnownProvider(provider)) {
    return unknownProvider(provider);
  }
  const keys = secretKeysFor(provider);
  if (envHasSecret(env, keys)) {
    return null;
  }
  const named = keys.join(" or ");
  return reject(
    "MISSING_SECRET",
    `${named} is missing for ${seatLabelOf(provider)}. Add it to the environment and try again.`,
    { provider, keys },
  );
}

function toRendererSeat(seat) {
  if (!seat) {
    return null;
  }
  const cutover = seat.cutover === "attached" || seat.cutover === true;
  return {
    id: seat.id,
    name: seat.id === "human" ? "You" : seat.label || seatLabelOf(seat.id),
    kind: seat.kind,
    presence: seat.presence,
    cutover,
    in_studio_only: seat.in_studio_only === true || cutover,
  };
}

function providers() {
  return KNOWN_PROVIDERS.map((id) => ({ id, label: seatLabelOf(id) }));
}

function createSeatsSession(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const home = Object.prototype.hasOwnProperty.call(opts, "home")
    ? opts.home
    : defaultHome();
  const studio = opts.studio || createStudioSeats({
    home,
    clock: opts.clock || null,
  });

  function connect(provider) {
    if (!isKnownProvider(provider)) {
      return unknownProvider(provider);
    }
    const secret = missingSecret(provider, env);
    if (secret) {
      return secret;
    }

    const registered = studio.seats.register({
      id: provider,
      kind: seatKindOf(provider),
      label: seatLabelOf(provider),
    });
    if (!registered.ok) {
      return reject(registered.code, registered.detail);
    }

    const connected = studio.seats.connect(provider);
    if (!connected.ok) {
      return reject(connected.code, connected.detail);
    }

    const attached = studio.cutover.attach(provider);
    if (!attached.ok) {
      return reject(attached.code, attached.detail);
    }

    const seat = attached.data && attached.data.seat
      ? attached.data.seat
      : connected.data.seat;
    const presence = studio.presence.get(provider);
    const listed = studio.presence.list();
    const roster = listed.ok && listed.data && Array.isArray(listed.data.presence)
      ? listed.data.presence
      : [];

    return {
      ok: true,
      provider,
      connected_at: connected.data.connected_at,
      tools_allowed: connected.data.tools_allowed,
      cutover: true,
      in_studio_only: true,
      ack: connected.data.ack || CONNECT_ACK,
      seat: toRendererSeat(seat),
      presence: presence.ok ? presence.data : null,
      roster,
      online_count: listed.ok && listed.data ? listed.data.online_count : 0,
      engine: SEATS_REL,
    };
  }

  function list() {
    const listed = studio.seats.list();
    if (!listed.ok) {
      return reject(listed.code, listed.detail);
    }
    return {
      ok: true,
      seats: listed.data.seats.map(toRendererSeat),
    };
  }

  function presence() {
    const listed = studio.presence.list();
    if (!listed.ok) {
      return reject(listed.code, listed.detail);
    }
    return {
      ok: true,
      presence: listed.data.presence,
      online_count: listed.data.online_count,
    };
  }

  return {
    connect,
    list,
    presence,
    providers,
    studio,
    home,
  };
}

module.exports = {
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  KNOWN_PROVIDERS,
  SEATS_REL,
  createSeatsSession,
  createStudioSeats,
  defaultHome,
  envHasSecret,
  isKnownProvider,
  missingSecret,
  providers,
  secretKeysFor,
  seatLabelOf,
  toRendererSeat,
  unknownProvider,
};
