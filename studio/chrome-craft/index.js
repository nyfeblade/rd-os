"use strict";

/**
 * studio/chrome-craft — consume-only chrome motion + event SFX player.
 *
 * Shell imports this after PR#11. Do not author DSP here (studio/sfx-engine).
 * Do not edit studio/shell from this lane.
 */

const { EVENT_IDS, REQUIRED_EVENTS, NEED_YOU_GATED } = require("./events");
const {
  PACK_ID,
  DEFAULT_PACK_DIR,
  loadPack,
  bindingOf,
  assetPath,
  assetUrl,
  missingRequiredEvents,
} = require("./pack");
const motion = require("./motion");
const {
  createPlayer,
  getDefaultPlayer,
  resetDefaultPlayer,
  play,
  setMuted,
  isMuted,
  setSfxDespiteReducedMotion,
} = require("./player");

const VISUAL_LOCK = {
  bg: "#ffffff",
  white: "#ffffff",
  slate: "#64748b",
  ink: "#111111",
  black: "#000000",
  line: "#e2e8f0",
};

module.exports = {
  play,
  createPlayer,
  getDefaultPlayer,
  resetDefaultPlayer,
  setMuted,
  isMuted,
  setSfxDespiteReducedMotion,
  motion,
  loadPack,
  bindingOf,
  assetPath,
  assetUrl,
  missingRequiredEvents,
  PACK_ID,
  DEFAULT_PACK_DIR,
  EVENT_IDS,
  REQUIRED_EVENTS,
  NEED_YOU_GATED,
  VISUAL_LOCK,
};
