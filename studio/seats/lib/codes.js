"use strict";

const DEFAULT_SEAT_IDS = Object.freeze(["grok", "claude", "cursor", "human"]);
const DEFAULT_BOT_SEAT_IDS = Object.freeze(["grok", "claude", "cursor"]);
const SEAT_IDS = DEFAULT_SEAT_IDS;
const BOT_SEAT_IDS = DEFAULT_BOT_SEAT_IDS;
/** Coding-agent providers connect() may register on demand. Default roster stays four seats. */
const KNOWN_PROVIDERS = Object.freeze(["claude", "grok", "cursor", "codex", "gemini", "chatgpt"]);
const ROOM_KINDS = Object.freeze(["bot_bot", "human_bot", "studio_all"]);
const PRESENCE_STATES = Object.freeze(["online", "away", "offline"]);
const DEFAULT_CHROME = Object.freeze(["Chat", "Board"]);
const CODE_MODE = "on-demand";
const IN_STUDIO_ONLY_LABEL = "in-studio-only";
const CONNECT_ACK = "This seat works in Studio only while connected.";
const CUTOVER_STATES = Object.freeze(["attached", "unattached"]);
const SPEECH_CHANNELS = Object.freeze([
  "studio_room",
  "operator_1to1",
  "external_group",
  "external_dm",
  "external_connector",
]);

const REJECT_CODES = Object.freeze([
  "CUTOVER_REQUIRED",
  "CUTOVER_LOCKED",
  "EXTERNAL_CHANNEL_FORBIDDEN",
  "OPERATOR_1TO1_FORBIDDEN",
  "SEAT_DISCONNECTED",
  "ROOM_NOT_FOUND",
  "SEAT_NOT_MEMBER",
  "UNKNOWN_SEAT",
  "UNKNOWN_ROOM_KIND",
  "BAD_DESTINATION",
  "TOOL_REQUIRES_HITL",
  "TOOL_NOT_ALLOWED",
]);

const PRODUCT_LOCK = "connected_bots_speak_only_in_studio";
const DUMP_SCHEMA = "studio.seats.dump/v1";
const LEGAL_CHANNEL = "studio_room";
const ENG_DOMAIN = "eng";
const ENG_PURPOSE = "coding_agent_bot_bot";
const ENG_SURFACES = Object.freeze(["seat", "room", "cutover"]);

const FORBIDDEN_DESTINATIONS = Object.freeze([
  "operator",
  "owner",
  "operator_1to1",
  "1:1",
  "1to1",
  "dm:human",
  "dm:operator",
  "luke",
  "luke_1to1",
  "dm:luke",
  "group",
  "hq",
  "factory",
]);

const RESERVED_SEAT_IDS = Object.freeze([
  "luke",
  "owner",
  "operator",
  "life",
  "life-os",
  "journal",
  "personal",
  "family",
  "calendar",
  "group",
  "hq",
  "factory",
]);

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function assertNeverSeatId(id) {
  throw new Error(`unhandled StudioSeatId: ${id}`);
}

function assertNeverSeatKind(kind) {
  throw new Error(`unhandled StudioSeatKind: ${kind}`);
}

function assertNeverPresence(state) {
  throw new Error(`unhandled PresenceState: ${state}`);
}

function assertNeverCutover(state) {
  throw new Error(`unhandled CutoverState: ${state}`);
}

function assertNeverRoomKind(kind) {
  throw new Error(`unhandled RoomKind: ${kind}`);
}

function assertNeverSpeechChannel(channel) {
  throw new Error(`unhandled SpeechChannel: ${channel}`);
}

function assertNeverReject(code) {
  throw new Error(`unhandled CutoverRejectCode: ${code}`);
}

function agentFromKind(kind) {
  switch (kind) {
    case "bot":
      return "coding_agent";
    case "human":
      return "human";
    default:
      return assertNeverSeatKind(kind);
  }
}

function agentOf(id) {
  return agentFromKind(seatKindOf(id));
}

function seatKindOf(id) {
  switch (id) {
    case "grok":
    case "claude":
    case "cursor":
    case "codex":
    case "gemini":
    case "chatgpt":
      return "bot";
    case "human":
      return "human";
    default:
      return "bot";
  }
}

function seatLabelOf(id) {
  switch (id) {
    case "grok":
      return "Grok";
    case "claude":
      return "Claude";
    case "cursor":
      return "Cursor";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    case "chatgpt":
      return "ChatGPT";
    case "human":
      return "Human";
    default:
      return String(id)
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function isKnownProvider(value) {
  return KNOWN_PROVIDERS.includes(value);
}

function isConnectableId(value) {
  return isBuiltinSeatId(value) || isKnownProvider(value);
}

function isBuiltinSeatId(value) {
  return DEFAULT_SEAT_IDS.includes(value);
}

function isValidSeatSlug(value) {
  return typeof value === "string" && /^[a-z][a-z0-9_-]{0,31}$/.test(value);
}

function isReservedSeatId(value) {
  return RESERVED_SEAT_IDS.includes(value);
}

function isSeatId(value) {
  return isBuiltinSeatId(value);
}

function isBotSeat(id) {
  return isBuiltinSeatId(id) && seatKindOf(id) === "bot";
}

function isRoomKind(value) {
  return ROOM_KINDS.includes(value);
}

function isPresenceState(value) {
  return PRESENCE_STATES.includes(value);
}

/** online | away = in studio (may speak). offline cannot. */
function isInStudioPresence(state) {
  switch (state) {
    case "online":
    case "away":
      return true;
    case "offline":
      return false;
    default:
      return assertNeverPresence(state);
  }
}

module.exports = {
  DEFAULT_SEAT_IDS,
  DEFAULT_BOT_SEAT_IDS,
  SEAT_IDS,
  BOT_SEAT_IDS,
  KNOWN_PROVIDERS,
  RESERVED_SEAT_IDS,
  ROOM_KINDS,
  PRESENCE_STATES,
  DEFAULT_CHROME,
  CODE_MODE,
  IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK,
  CUTOVER_STATES,
  SPEECH_CHANNELS,
  REJECT_CODES,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
  LEGAL_CHANNEL,
  ENG_DOMAIN,
  ENG_PURPOSE,
  ENG_SURFACES,
  FORBIDDEN_DESTINATIONS,
  reject,
  ok,
  assertNeverSeatId,
  assertNeverSeatKind,
  assertNeverPresence,
  assertNeverCutover,
  assertNeverRoomKind,
  assertNeverSpeechChannel,
  assertNeverReject,
  agentFromKind,
  agentOf,
  seatKindOf,
  seatLabelOf,
  isKnownProvider,
  isConnectableId,
  isBuiltinSeatId,
  isValidSeatSlug,
  isReservedSeatId,
  isSeatId,
  isBotSeat,
  isRoomKind,
  isPresenceState,
  isInStudioPresence,
};
