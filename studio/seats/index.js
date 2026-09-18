"use strict";

const codes = require("./lib/codes");
const { classifyDestination, speechChannelOf, channelReject } = require("./lib/classify");
const { createStudioSeats, buildDemoDump } = require("./lib/studio");

module.exports = {
  createStudioSeats,
  buildDemoDump,
  classifyDestination,
  speechChannelOf,
  channelReject,
  SEAT_IDS: codes.SEAT_IDS,
  BOT_SEAT_IDS: codes.BOT_SEAT_IDS,
  ROOM_KINDS: codes.ROOM_KINDS,
  PRESENCE_STATES: codes.PRESENCE_STATES,
  DEFAULT_CHROME: codes.DEFAULT_CHROME,
  CODE_MODE: codes.CODE_MODE,
  IN_STUDIO_ONLY_LABEL: codes.IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK: codes.CONNECT_ACK,
  CUTOVER_STATES: codes.CUTOVER_STATES,
  SPEECH_CHANNELS: codes.SPEECH_CHANNELS,
  REJECT_CODES: codes.REJECT_CODES,
  PRODUCT_LOCK: codes.PRODUCT_LOCK,
  DUMP_SCHEMA: codes.DUMP_SCHEMA,
  LEGAL_CHANNEL: codes.LEGAL_CHANNEL,
  FORBIDDEN_DESTINATIONS: codes.FORBIDDEN_DESTINATIONS,
  seatKindOf: codes.seatKindOf,
  seatLabelOf: codes.seatLabelOf,
  isInStudioPresence: codes.isInStudioPresence,
};
