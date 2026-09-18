"use strict";

(function attachModesRail(Studio) {
  const assertNever = Studio.assertNever;

  function modeLabel(mode) {
    switch (mode) {
      case "build":
        return "build";
      case "proof":
        return "proof";
      case "review":
        return "review";
      default:
        return assertNever(mode);
    }
  }

  function nextMode(mode) {
    switch (mode) {
      case "build":
        return "proof";
      case "proof":
        return "review";
      case "review":
        return "build";
      default:
        return assertNever(mode);
    }
  }

  function renderMode(els, state) {
    els.modeChip.textContent = modeLabel(state.mode);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.modeLabel = modeLabel;
  Studio.chrome.nextMode = nextMode;
  Studio.chrome.renderMode = renderMode;
})(globalThis.StudioShell = globalThis.StudioShell || {});
