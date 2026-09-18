"use strict";

const {
  assertNeverSpeechChannel,
  reject,
} = require("./codes");

const OPERATOR_ALIASES = new Set([
  "operator",
  "owner",
  "operator_1to1",
  "owner_1to1",
  "human_1to1",
  "1:1",
  "1to1",
  "dm:human",
  "dm/human",
  "dm:operator",
  "dm/operator",
  "dm:owner",
  "dm/owner",
  "luke",
  "luke_1to1",
  "luke-1-1",
  "luke-dm",
  "dm:luke",
  "dm/luke",
  "grok:luke",
  "grok/luke",
  "external:luke",
  "external/luke",
]);

const LIFE_OS_ALIASES = new Set([
  "life",
  "life-os",
  "life_os",
  "lifeos",
  "journal",
  "personal",
  "family",
  "calendar",
]);

const GROUP_ALIASES = new Set([
  "group",
  "hq",
  "factory",
  "eng-hq",
  "eng_hq",
  "eng-factory",
  "eng_factory",
  "enghq",
  "engfactory",
]);

function normalizeDest(dest) {
  if (dest == null) {
    return "";
  }
  if (typeof dest === "object") {
    if (typeof dest.room_id === "string" && dest.room_id.trim()) {
      const roomId = dest.room_id.trim();
      return roomId.startsWith("room:") ? roomId : `room:${roomId}`;
    }
    if (typeof dest.channel === "string" && dest.channel.trim()) {
      return dest.channel.trim().toLowerCase();
    }
    if (typeof dest.to === "string") {
      return dest.to.trim().toLowerCase();
    }
    return "";
  }
  return String(dest).trim().toLowerCase();
}

function speechChannelOf(dest) {
  const raw = normalizeDest(dest);
  if (!raw) {
    return { channel: "external_connector", dest: raw, room_id: null };
  }
  if (raw.startsWith("room:") || raw.startsWith("studio:")) {
    const roomId = raw.startsWith("studio:") ? `room:${raw.slice("studio:".length)}` : raw;
    return { channel: "studio_room", dest: raw, room_id: roomId };
  }
  if (
    OPERATOR_ALIASES.has(raw) ||
    raw.startsWith("luke:") ||
    raw.startsWith("luke/") ||
    raw.endsWith(":luke") ||
    raw.startsWith("operator:") ||
    raw.startsWith("owner:")
  ) {
    return { channel: "operator_1to1", dest: raw, room_id: null };
  }
  if (
    LIFE_OS_ALIASES.has(raw) ||
    raw.startsWith("life:") ||
    raw.startsWith("life-os:") ||
    raw.startsWith("life_os:")
  ) {
    return { channel: "external_connector", dest: raw, room_id: null };
  }
  if (GROUP_ALIASES.has(raw) || raw.startsWith("slack:") || raw.startsWith("discord:")) {
    return { channel: "external_group", dest: raw, room_id: null };
  }
  if (raw.startsWith("dm:") || raw.startsWith("dm/")) {
    return { channel: "external_dm", dest: raw, room_id: null };
  }
  if (raw.startsWith("connector:") || raw.startsWith("external:")) {
    return { channel: "external_connector", dest: raw, room_id: null };
  }
  return { channel: "external_connector", dest: raw, room_id: null };
}

function classifyDestination(dest) {
  return speechChannelOf(dest);
}

function channelReject(classified) {
  switch (classified.channel) {
    case "studio_room":
      return null;
    case "operator_1to1":
      return reject(
        "OPERATOR_1TO1_FORBIDDEN",
        `hard cutover: studio connectors have no operator/1:1 path (dest=${classified.dest || "<empty>"})`
      );
    case "external_group":
    case "external_dm":
    case "external_connector":
      return reject(
        "EXTERNAL_CHANNEL_FORBIDDEN",
        `hard cutover: connected bots speak only in-studio (channel=${classified.channel}, dest=${classified.dest || "<empty>"})`
      );
    default:
      return assertNeverSpeechChannel(classified.channel);
  }
}

module.exports = {
  normalizeDest,
  speechChannelOf,
  classifyDestination,
  channelReject,
};
