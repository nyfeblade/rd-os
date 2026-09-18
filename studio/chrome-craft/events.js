"use strict";

/**
 * Closed Studio chrome event ids (STUDIO-EVENTS consume catalog).
 * Authoring IR lives in studio/sfx-engine — this module only plays exports.
 */

const EVENT_IDS = [
  "ui.send",
  "ui.need_you",
  "ui.approve",
  "ui.deny",
  "ui.connect_ok",
  "ui.error",
  "ui.code_open",
  "ui.expand",
  "ui.craft_gen_done",
];

const REQUIRED_EVENTS = EVENT_IDS.slice();

const NEED_YOU_GATED = ["ui.need_you", "ui.expand"];

module.exports = {
  EVENT_IDS,
  REQUIRED_EVENTS,
  NEED_YOU_GATED,
};
