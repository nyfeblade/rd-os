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

  function renderPresence(els, state) {
    const online = onlineMembers(state.seats);
    els.presenceCount.textContent = `${online.length} online`;
    els.presenceBtn.hidden = true;
    els.presenceBtn.setAttribute("aria-hidden", "true");
    els.presenceList.hidden = true;
    els.presenceList.replaceChildren();
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.presenceDotClass = presenceDotClass;
  Studio.chrome.onlineMembers = onlineMembers;
  Studio.chrome.renderPresence = renderPresence;
})(globalThis.StudioShell = globalThis.StudioShell || {});
