"use strict";

(function attachChatPane(Studio) {
  const THREADS = {
    human: [
      {
        who: "Studio",
        body: "Talk to agents here. The Board shows what’s blocked on you. Code stays closed until you ask.",
        me: false,
      },
    ],
    grok: [{ who: "Grok", body: "Connect this seat to chat. Work stays in Studio only while connected.", me: false }],
    claude: [{ who: "Claude", body: "Connect this seat to chat. Work stays in Studio only while connected.", me: false }],
    cursor: [{ who: "Cursor", body: "Connect this seat to chat. Work stays in Studio only while connected.", me: false }],
    "room:chat": [{ who: "Agents", body: "A project room. Connect to cut over — any provider.", me: false }],
  };

  function coldOpenSeats() {
    return [
      { id: "human", name: "You", kind: "human", presence: "online", cutover: true },
      { id: "grok", name: "Grok", kind: "bot", presence: "offline", cutover: false },
      { id: "claude", name: "Claude", kind: "bot", presence: "offline", cutover: false },
      { id: "cursor", name: "Cursor", kind: "bot", presence: "offline", cutover: false },
      { id: "room:chat", name: "Agents", kind: "room", presence: "offline", cutover: false },
    ];
  }

  function selectedSeat(state) {
    return state.seats.find((seat) => seat.id === state.selectedSeat) || state.seats[0];
  }

  function renderSeats(els, state, handlers) {
    const presenceDotClass = Studio.chrome.presenceDotClass;
    els.seatList.replaceChildren();
    for (const seat of state.seats) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = seat.id === state.selectedSeat ? "seat on" : "seat";
      button.dataset.seat = seat.id;
      const row = document.createElement("div");
      row.className = "row";
      const dot = document.createElement("i");
      if (presenceDotClass(seat.presence)) {
        dot.className = presenceDotClass(seat.presence);
      }
      row.append(dot, document.createTextNode(seat.name));
      button.appendChild(row);
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = seat.cutover ? "in-studio-only" : "connect";
      button.appendChild(badge);
      button.addEventListener("click", () => {
        if (!seat.cutover) {
          handlers.onConnectSeat(seat);
          return;
        }
        state.selectedSeat = seat.id;
        renderSeats(els, state, handlers);
        renderThread(els, state);
      });
      els.seatList.appendChild(button);
    }
  }

  function renderThread(els, state) {
    const seat = selectedSeat(state);
    els.composerInput.placeholder = `Message ${seat.name}…`;
    const messages = THREADS[seat.id] || [];
    els.messages.replaceChildren();
    for (const message of messages) {
      const wrap = document.createElement("div");
      wrap.className = message.me ? "bubble me" : "bubble";
      const who = document.createElement("div");
      who.className = "meta";
      who.textContent = message.who;
      const body = document.createElement("div");
      body.className = "text";
      body.textContent = message.body;
      wrap.append(who, body);
      els.messages.appendChild(wrap);
    }
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function pushLocal(seatId, message) {
    if (!THREADS[seatId]) {
      THREADS[seatId] = [];
    }
    THREADS[seatId].push(message);
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.THREADS = THREADS;
  Studio.panes.coldOpenSeats = coldOpenSeats;
  Studio.panes.selectedSeat = selectedSeat;
  Studio.panes.renderSeats = renderSeats;
  Studio.panes.renderThread = renderThread;
  Studio.panes.pushLocal = pushLocal;
})(globalThis.StudioShell = globalThis.StudioShell || {});
