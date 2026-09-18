"use strict";

(function attachModesRail(Studio) {
  const assertNever = Studio.assertNever;
  const MODES = ["eng", "design"];

  function modeLabel(mode) {
    switch (mode) {
      case "eng":
        return "eng";
      case "design":
        return "design";
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

  function renderMode(els, state, _onMode) {
    els.modeChip.replaceChildren();
    els.modeChip.dataset.mode = state.mode;
    els.modeChip.hidden = true;
    els.modeChip.setAttribute("aria-hidden", "true");
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.modeLabel = modeLabel;
  Studio.chrome.nextMode = nextMode;
  Studio.chrome.renderMode = renderMode;
})(globalThis.StudioShell = globalThis.StudioShell || {});
