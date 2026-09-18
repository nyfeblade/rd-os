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
    return (seats || []).filter((member) => member.presence === "online");
  }

  function isInStudioSeat(seat) {
    return Boolean(seat && (seat.in_studio_only === true || seat.cutover === true || seat.cutover === "attached"));
  }

  function shouldShowPresence(state) {
    return (state.seats || []).some(
      (seat) => seat.kind === "bot" && (seat.presence === "online" || isInStudioSeat(seat)),
    );
  }

  function renderCutoverChip(els, state) {
    const chip = els.cutoverChip;
    if (!chip) {
      return;
    }
    const attached = (state.seats || []).some((seat) => seat.kind === "bot" && isInStudioSeat(seat));
    chip.hidden = !attached;
    chip.textContent = "in-studio";
  }

  function presenceLabel(member) {
    const name = member.name || member.id;
    if (isInStudioSeat(member)) {
      return `${name} · in-studio-only`;
    }
    return name;
  }

  function renderPresence(els, state) {
    const online = onlineMembers(state.seats);
    els.presenceCount.textContent = String(online.length);
    const show = shouldShowPresence(state);
    els.presenceBtn.hidden = !show;
    els.presenceBtn.setAttribute("aria-hidden", String(!show));
    els.presenceList.replaceChildren();
    if (!show || !state.presenceOpen) {
      els.presenceList.hidden = true;
      renderCutoverChip(els, state);
      return;
    }
    els.presenceList.hidden = false;
    for (const member of online) {
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      row.className = "presence-row";
      row.dataset.seat = member.id;
      row.dataset.presence = member.presence;
      row.dataset.inStudioOnly = String(isInStudioSeat(member));
      const dot = document.createElement("span");
      dot.className = `dot ${presenceDotClass(member.presence)}`.trim();
      const label = document.createElement("span");
      label.textContent = presenceLabel(member);
      row.append(dot, label);
      els.presenceList.appendChild(row);
    }
    renderCutoverChip(els, state);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.presenceDotClass = presenceDotClass;
  Studio.chrome.onlineMembers = onlineMembers;
  Studio.chrome.shouldShowPresence = shouldShowPresence;
  Studio.chrome.renderPresence = renderPresence;
})(globalThis.StudioShell = globalThis.StudioShell || {});
