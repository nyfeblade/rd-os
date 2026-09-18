"use strict";

const {
  DEFAULT_SEAT_IDS,
  DEFAULT_BOT_SEAT_IDS,
  DEFAULT_CHROME,
  CODE_MODE,
  CONNECT_ACK,
  IN_STUDIO_ONLY_LABEL,
  seatKindOf,
  seatLabelOf,
} = require("../../seats");

function displayName(id) {
  switch (id) {
    case "human":
      return "You";
    case "grok":
    case "claude":
    case "cursor":
      return seatLabelOf(id);
    default:
      return seatLabelOf(id);
  }
}

function coldOpenSeats() {
  const you = {
    id: "human",
    name: displayName("human"),
    kind: "human",
    presence: "online",
    cutover: true,
  };
  const bots = DEFAULT_BOT_SEAT_IDS.map((id) => ({
    id,
    name: displayName(id),
    kind: seatKindOf(id),
    presence: "offline",
    cutover: false,
  }));
  const room = {
    id: "room:chat",
    name: "Agents",
    kind: "room",
    presence: "offline",
    cutover: false,
  };
  return [you, ...bots, room];
}

function onboardThread(id) {
  switch (id) {
    case "human":
      return [
        {
          who: "Studio",
          body: "Talk to agents here. The Board shows what’s blocked on you. Code stays closed until you ask.",
          me: false,
        },
      ];
    case "grok":
    case "claude":
    case "cursor":
      return [
        {
          who: displayName(id),
          body: "Connect this seat to chat. Work stays in Studio only while connected.",
          me: false,
        },
      ];
    case "room:chat":
      return [
        {
          who: "Agents",
          body: "A project room. Connect to cut over — any provider.",
          me: false,
        },
      ];
    default:
      return [
        {
          who: displayName(id),
          body: "Connect this seat to chat. Work stays in Studio only while connected.",
          me: false,
        },
      ];
  }
}

module.exports = {
  CODE_MODE,
  CONNECT_ACK,
  DEFAULT_CHROME,
  DEFAULT_SEAT_IDS,
  DEFAULT_BOT_SEAT_IDS,
  IN_STUDIO_ONLY_LABEL,
  coldOpenSeats,
  displayName,
  onboardThread,
};
