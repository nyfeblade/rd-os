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
    els.presenceList.replaceChildren();
    for (const member of state.seats) {
      const row = document.createElement("div");
      row.className = "popover-row";
      row.setAttribute("role", "listitem");
      const name = document.createElement("span");
      name.textContent = member.name;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent =
        member.cutover && member.presence === "online" ? "in-studio-only" : member.presence;
      row.append(name, meta);
      els.presenceList.appendChild(row);
    }
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.presenceDotClass = presenceDotClass;
  Studio.chrome.onlineMembers = onlineMembers;
  Studio.chrome.renderPresence = renderPresence;
})(globalThis.StudioShell = globalThis.StudioShell || {});
