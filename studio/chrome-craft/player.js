"use strict";

const fs = require("fs");
const { NEED_YOU_GATED } = require("./events");
const { DEFAULT_PACK_DIR, loadPack, bindingOf, assetPath, assetUrl } = require("./pack");
const { prefersReducedMotion } = require("./motion");

function clampGain(gain) {
  if (typeof gain !== "number" || Number.isNaN(gain)) return 1;
  if (gain < 0) return 0;
  if (gain > 1) return 1;
  return gain;
}

function skipped(eventId, reason) {
  return { ok: true, played: false, reason, eventId: eventId || null };
}

function played(eventId) {
  return { ok: true, played: true, reason: null, eventId };
}

function fileExists(abs) {
  if (typeof fs.existsSync !== "function") return true;
  try {
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

function defaultPlayAsset(src, gain) {
  if (typeof Audio !== "function") return;
  const audio = new Audio(src);
  audio.volume = clampGain(gain);
  const started = audio.play();
  if (started && typeof started.catch === "function") {
    started.catch(function () {});
  }
}

function createPlayer(options) {
  const opts = options || {};
  const packDir = opts.packDir || DEFAULT_PACK_DIR;
  const packUrl = typeof opts.packUrl === "string" ? opts.packUrl : "";
  const pack = opts.pack && typeof opts.pack === "object" ? opts.pack : loadPack(packDir);
  const lastPlayed = Object.create(null);
  const playAsset = typeof opts.playAsset === "function" ? opts.playAsset : defaultPlayAsset;
  const nowFn = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };

  const state = {
    muted: opts.muted === true,
    sfxDespiteReducedMotion: opts.sfxDespiteReducedMotion === true,
    prefersReducedMotion:
      typeof opts.prefersReducedMotion === "boolean"
        ? opts.prefersReducedMotion
        : prefersReducedMotion(opts),
  };

  function reducedMotionNow() {
    if (typeof opts.prefersReducedMotion === "boolean") return opts.prefersReducedMotion;
    return prefersReducedMotion(opts);
  }

  function effectivelyMuted(ctx, binding) {
    if (ctx && ctx.muted === true) return true;
    if (state.muted) return true;
    const reduced = reducedMotionNow();
    if (!reduced) return false;
    if (binding && binding.reduced_motion_mute) return true;
    return !state.sfxDespiteReducedMotion;
  }

  function quietNeedYou(eventId, ctx) {
    if (!ctx || ctx.need_you !== false) return false;
    return NEED_YOU_GATED.indexOf(eventId) !== -1;
  }

  function play(eventId, context) {
    try {
      const ctx = context || {};
      if (typeof eventId !== "string" || eventId === "") {
        return skipped(eventId, "invalid");
      }
      if (!pack || pack.ok === false) {
        return skipped(eventId, pack && pack.reason ? pack.reason : "missing_pack");
      }
      if (quietNeedYou(eventId, ctx)) {
        return skipped(eventId, "quiet");
      }
      const binding = bindingOf(pack, eventId);
      if (!binding) {
        return skipped(eventId, "unbound");
      }
      if (effectivelyMuted(ctx, binding)) {
        return skipped(eventId, "muted");
      }
      const t = nowFn();
      const prev = lastPlayed[eventId];
      if (typeof prev === "number" && t - prev < binding.cooldown_ms) {
        return skipped(eventId, "cooldown");
      }
      const abs = assetPath(pack, eventId);
      if (abs && !fileExists(abs)) {
        return skipped(eventId, "missing");
      }
      const src = assetUrl(pack, eventId, packUrl) || abs;
      if (!src) {
        return skipped(eventId, "missing");
      }
      playAsset(src, clampGain(binding.gain));
      lastPlayed[eventId] = t;
      return played(eventId);
    } catch {
      return skipped(eventId, "error");
    }
  }

  return {
    play,
    setMuted(value) {
      state.muted = value === true;
      return state.muted;
    },
    isMuted() {
      return state.muted === true;
    },
    setSfxDespiteReducedMotion(value) {
      state.sfxDespiteReducedMotion = value === true;
      return state.sfxDespiteReducedMotion;
    },
    pack,
    packDir,
  };
}

let defaultPlayer = null;

function getDefaultPlayer() {
  if (!defaultPlayer) defaultPlayer = createPlayer();
  return defaultPlayer;
}

function resetDefaultPlayer() {
  defaultPlayer = null;
}

function play(eventId, context) {
  try {
    return getDefaultPlayer().play(eventId, context);
  } catch {
    return skipped(eventId, "error");
  }
}

function setMuted(value) {
  return getDefaultPlayer().setMuted(value);
}

function isMuted() {
  return getDefaultPlayer().isMuted();
}

function setSfxDespiteReducedMotion(value) {
  return getDefaultPlayer().setSfxDespiteReducedMotion(value);
}

module.exports = {
  createPlayer,
  getDefaultPlayer,
  resetDefaultPlayer,
  play,
  setMuted,
  isMuted,
  setSfxDespiteReducedMotion,
};
