"use strict";

(function attachTokenMeter(Studio) {
  function knownTokens(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function formatTokens(value) {
    if (!knownTokens(value)) {
      return null;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k tok`;
    }
    return `${value} tok`;
  }

  function renderMeter(host, value, label) {
    if (!host) {
      return;
    }
    const text = formatTokens(value);
    host.replaceChildren();
    if (!text) {
      host.hidden = true;
      host.textContent = "";
      return;
    }
    host.hidden = false;
    host.classList.add("meter");
    host.textContent = `${label} · est. ${text}`;
  }

  function renderTokenMeters(els, state) {
    const tokens = state.tokens || {};
    renderMeter(els.threadMeter, tokens.session, "session");
    renderMeter(els.boardMeter, tokens.board, "run");
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.knownTokens = knownTokens;
  Studio.chrome.formatTokens = formatTokens;
  Studio.chrome.renderTokenMeters = renderTokenMeters;
})(globalThis.StudioShell = globalThis.StudioShell || {});
