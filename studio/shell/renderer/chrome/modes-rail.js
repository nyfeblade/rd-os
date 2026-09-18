"use strict";

(function attachModesRail(Studio) {
  const assertNever = Studio.assertNever;

  function modeLabel(mode) {
    switch (mode) {
      case "eng":
        return "eng ▾";
      case "design":
        return "design ▾";
      default:
        return assertNever(mode);
    }
  }

  function nextMode(mode) {
    switch (mode) {
      case "eng":
        return "design";
      case "design":
        return "eng";
      default:
        return assertNever(mode);
    }
  }

  function renderMode(els, state) {
    els.modeChip.textContent = modeLabel(state.mode);
    els.modeChip.dataset.mode = state.mode;
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.modeLabel = modeLabel;
  Studio.chrome.nextMode = nextMode;
  Studio.chrome.renderMode = renderMode;
})(globalThis.StudioShell = globalThis.StudioShell || {});
