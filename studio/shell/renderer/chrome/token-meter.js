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

  function renderSeatMeters(host, seats) {
    if (!host) {
      return;
    }
    host.replaceChildren();
    const rows = seats && typeof seats === "object" ? Object.entries(seats) : [];
    const known = rows.filter(([, value]) => knownTokens(value));
    if (!known.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.classList.add("meter");
    host.textContent = known
      .map(([seat, value]) => `${seat} · est. ${formatTokens(value)}`)
      .join(" · ");
  }

  function renderTokenMeters(els, state) {
    const tokens = state.tokens || {};
    const seatId = state.selectedSeat;
    const seatVal = tokens.seats && seatId ? tokens.seats[seatId] : null;
    renderMeter(els.threadMeter, knownTokens(seatVal) ? seatVal : tokens.session, "seat");
    renderMeter(els.boardMeter, knownTokens(tokens.mission) ? tokens.mission : tokens.board, "mission");
    renderSeatMeters(els.seatMeters, tokens.seats);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.knownTokens = knownTokens;
  Studio.chrome.formatTokens = formatTokens;
  Studio.chrome.renderTokenMeters = renderTokenMeters;
})(globalThis.StudioShell = globalThis.StudioShell || {});
