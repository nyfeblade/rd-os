"use strict";

/**
 * Chrome motion helpers for shell consume (after PR#11).
 * Code drawer ≤180ms ease. Need-you row expand ≤100ms. No bounce.
 * prefers-reduced-motion → 0ms instant.
 */

const CODE_DRAWER_MS = 180;
const NEED_YOU_EXPAND_MS = 80;
const CODE_DRAWER_MS_MAX = 180;
const NEED_YOU_EXPAND_MS_MAX = 100;
const EASING = "ease";
const BOUNCE = false;

function prefersReducedMotion(env) {
  if (env && typeof env.prefersReducedMotion === "boolean") {
    return env.prefersReducedMotion;
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.matchMedia === "function") {
    try {
      return Boolean(globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  }
  return false;
}

function durationMs(ms, env) {
  if (prefersReducedMotion(env)) return 0;
  return ms;
}

function spec(ms, properties, env) {
  const resolved = durationMs(ms, env);
  const props = properties || ["all"];
  const transition =
    resolved === 0 ? "none" : props.map((property) => `${property} ${resolved}ms ${EASING}`).join(", ");
  return {
    ms: resolved,
    maxMs: ms,
    easing: EASING,
    bounce: BOUNCE,
    instant: resolved === 0,
    reducedMotion: prefersReducedMotion(env),
    transition,
    css: {
      transition,
      transitionDuration: `${resolved}ms`,
      transitionTimingFunction: EASING,
    },
  };
}

function codeDrawer(env) {
  return spec(CODE_DRAWER_MS, ["width", "transform", "opacity"], env);
}

function codeDrawerOpen(env) {
  return codeDrawer(env);
}

function codeDrawerClose(env) {
  return codeDrawer(env);
}

function needYouExpand(env) {
  return spec(NEED_YOU_EXPAND_MS, ["height", "max-height", "opacity"], env);
}

function apply(el, motionSpec) {
  if (!el || !el.style || !motionSpec) return motionSpec;
  el.style.transition = motionSpec.transition;
  return motionSpec;
}

module.exports = {
  CODE_DRAWER_MS,
  NEED_YOU_EXPAND_MS,
  CODE_DRAWER_MS_MAX,
  NEED_YOU_EXPAND_MS_MAX,
  EASING,
  BOUNCE,
  prefersReducedMotion,
  durationMs,
  codeDrawer,
  codeDrawerOpen,
  codeDrawerClose,
  needYouExpand,
  apply,
};
