"use strict";

const SEAT_IDS = Object.freeze(["grok", "claude", "cursor", "human"]);
const BOT_SEAT_IDS = Object.freeze(["grok", "claude", "cursor"]);
const ROOM_KINDS = Object.freeze(["bot_bot", "human_bot", "studio_all"]);
const PRESENCE_STATES = Object.freeze(["online", "away", "offline"]);
const STUDIO_PANES = Object.freeze(["Chat", "Code", "Board"]);
const IN_STUDIO_ONLY_LABEL = "in-studio-only";
const CONNECT_ACK = "This seat works in Studio only while connected.";
const CUTOVER_STATES = Object.freeze(["attached", "unattached"]);
const SPEECH_CHANNELS = Object.freeze([
  "studio_room",
  "luke_1to1",
  "external_group",
  "external_dm",
  "external_connector",
]);

const REJECT_CODES = Object.freeze([
  "CUTOVER_REQUIRED",
  "CUTOVER_LOCKED",
  "EXTERNAL_CHANNEL_FORBIDDEN",
  "LUKE_1TO1_FORBIDDEN",
  "SEAT_DISCONNECTED",
  "ROOM_NOT_FOUND",
  "SEAT_NOT_MEMBER",
  "UNKNOWN_SEAT",
  "UNKNOWN_ROOM_KIND",
  "BAD_DESTINATION",
]);

const PRODUCT_LOCK = "connected_bots_speak_only_in_studio";
const DUMP_SCHEMA = "studio.seats.dump/v1";
const LEGAL_CHANNEL = "studio_room";

const FORBIDDEN_DESTINATIONS = Object.freeze([
  "luke",
  "luke_1to1",
  "1:1",
  "1to1",
  "dm:luke",
  "grok:luke",
  "external:luke",
  "group",
  "hq",
  "factory",
  "eng-hq",
  "eng-factory",
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

function seatKindOf(id) {
  switch (id) {
    case "grok":
    case "claude":
    case "cursor":
      return "bot";
    case "human":
      return "human";
    default:
      return assertNeverSeatId(id);
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
    case "human":
      return "Human";
    default:
      return assertNeverSeatId(id);
  }
}

function isSeatId(value) {
  return SEAT_IDS.includes(value);
}

function isBotSeat(id) {
  return isSeatId(id) && seatKindOf(id) === "bot";
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
  SEAT_IDS,
  BOT_SEAT_IDS,
  ROOM_KINDS,
  PRESENCE_STATES,
  STUDIO_PANES,
  IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK,
  CUTOVER_STATES,
  SPEECH_CHANNELS,
  REJECT_CODES,
  PRODUCT_LOCK,
  DUMP_SCHEMA,
  LEGAL_CHANNEL,
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
  seatKindOf,
  seatLabelOf,
  isSeatId,
  isBotSeat,
  isRoomKind,
  isPresenceState,
  isInStudioPresence,
};
