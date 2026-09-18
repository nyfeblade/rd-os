"use strict";

const codes = require("./lib/codes");
const { classifyDestination, speechChannelOf, channelReject } = require("./lib/classify");
const { createStudioSeats, buildDemoDump } = require("./lib/studio");
const permissions = require("./lib/permissions");
const roster = require("./lib/roster");

module.exports = {
  createStudioSeats,
  buildDemoDump,
  classifyDestination,
  speechChannelOf,
  channelReject,
  DEFAULT_SEAT_IDS: codes.DEFAULT_SEAT_IDS,
  DEFAULT_BOT_SEAT_IDS: codes.DEFAULT_BOT_SEAT_IDS,
  SEAT_IDS: codes.SEAT_IDS,
  BOT_SEAT_IDS: codes.BOT_SEAT_IDS,
  KNOWN_PROVIDERS: codes.KNOWN_PROVIDERS,
  ROOM_KINDS: codes.ROOM_KINDS,
  PRESENCE_STATES: codes.PRESENCE_STATES,
  DEFAULT_CHROME: codes.DEFAULT_CHROME,
  CODE_MODE: codes.CODE_MODE,
  ENG_DOMAIN: codes.ENG_DOMAIN,
  ENG_PURPOSE: codes.ENG_PURPOSE,
  ENG_SURFACES: codes.ENG_SURFACES,
  IN_STUDIO_ONLY_LABEL: codes.IN_STUDIO_ONLY_LABEL,
  CONNECT_ACK: codes.CONNECT_ACK,
  CUTOVER_STATES: codes.CUTOVER_STATES,
  SPEECH_CHANNELS: codes.SPEECH_CHANNELS,
  REJECT_CODES: codes.REJECT_CODES,
  PRODUCT_LOCK: codes.PRODUCT_LOCK,
  DUMP_SCHEMA: codes.DUMP_SCHEMA,
  LEGAL_CHANNEL: codes.LEGAL_CHANNEL,
  FORBIDDEN_DESTINATIONS: codes.FORBIDDEN_DESTINATIONS,
  DEFAULT_TOOLS_ALLOWED: permissions.DEFAULT_TOOLS_ALLOWED,
  HIGH_RISK_TOOLS: permissions.HIGH_RISK_TOOLS,
  SEAT_TOOLS: permissions.SEAT_TOOLS,
  CHAT_EMIT_SCOPE: permissions.CHAT_EMIT_SCOPE,
  agentOf: codes.agentOf,
  seatKindOf: codes.seatKindOf,
  seatLabelOf: codes.seatLabelOf,
  isInStudioPresence: codes.isInStudioPresence,
  isKnownProvider: codes.isKnownProvider,
  isConnectableId: codes.isConnectableId,
  toolsAllowedFor: permissions.toolsAllowedFor,
  toolRequiresHitl: permissions.toolRequiresHitl,
  isToolAllowed: permissions.isToolAllowed,
  authorizeTool: permissions.authorizeTool,
  permissionOf: permissions.permissionOf,
  defaultPermissionMatrix: permissions.defaultPermissionMatrix,
  highRiskPermissionMatrix: permissions.highRiskPermissionMatrix,
  importRoster: roster.importRoster,
  listImported: roster.listImported,
  listImportableSeats: roster.listImportableSeats,
  registerImportedSeat(studio, id) {
    if (!roster.isStudio(studio)) {
      return codes.reject("BAD_STUDIO", "registerImportedSeat(studio, id) needs a createStudioSeats() instance from the UI");
    }
    return studio.registerImportedSeat(id);
  },
  resolveGrokProvider: roster.resolveGrokProvider,
  IMPORTABLE_ROSTER: roster.IMPORTABLE_ROSTER,
  SKIPPED_ROSTER: roster.SKIPPED_ROSTER,
  IMPORTABLE_IDS: roster.IMPORTABLE_IDS,
  SKIPPED_IDS: roster.SKIPPED_IDS,
  GROK_ALIASES: roster.GROK_ALIASES,
  GROK_PROVIDER: roster.GROK_PROVIDER,
  ROSTER_SCHEMA: roster.ROSTER_SCHEMA,
  isImportableId: roster.isImportableId,
  isSkippedId: roster.isSkippedId,
  teamOf: roster.teamOf,
};
