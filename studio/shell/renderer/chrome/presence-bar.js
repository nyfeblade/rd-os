"use strict";

(function attachPresenceBar(Studio) {
  const assertNever = Studio.assertNever;

  function presenceDotClass(presence) {
    switch (presence) {
      case "online":
        return "";
      case "away":
        return "away";
      case "offline":
        return "off";
      default:
        return assertNever(presence);
    }
  }

  function onlineMembers(seats) {
    return seats.filter((member) => member.presence === "online");
  }

  function renderCutoverChip(els, state) {
    const chip = els.cutoverChip;
    if (!chip) {
      return;
    }
    const attached = (state.seats || []).some((seat) => seat.kind === "bot" && seat.cutover === true);
    chip.hidden = state.view === "cold" || !attached;
    chip.textContent = "in-studio";
  }

  function renderPresence(els, state) {
    const online = onlineMembers(state.seats);
    els.presenceCount.textContent = String(online.length);
    els.presenceBtn.hidden = true;
    els.presenceBtn.setAttribute("aria-hidden", "true");
    els.presenceList.hidden = true;
    els.presenceList.replaceChildren();
    renderCutoverChip(els, state);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.presenceDotClass = presenceDotClass;
  Studio.chrome.onlineMembers = onlineMembers;
  Studio.chrome.renderPresence = renderPresence;
})(globalThis.StudioShell = globalThis.StudioShell || {});
