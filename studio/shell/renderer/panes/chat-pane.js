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

  function firstUnconnectedBot(state) {
    return state.seats.find((seat) => seat.kind === "bot" && !seat.cutover) || null;
  }

  function anyBotConnected(state) {
    return state.seats.some((seat) => seat.kind === "bot" && seat.cutover);
  }

  function renderSeats(els, state, handlers) {
    const presenceDotClass = Studio.chrome.presenceDotClass;
    els.seatList.replaceChildren();
    for (const seat of state.seats) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = seat.id === state.selectedSeat ? "person on" : "person";
      button.dataset.seat = seat.id;
      const dot = document.createElement("i");
      if (presenceDotClass(seat.presence)) {
        dot.className = presenceDotClass(seat.presence);
      }
      button.append(dot, document.createTextNode(` ${seat.name} `));
      const badge = document.createElement("span");
      badge.className = "tag";
      badge.textContent = seat.cutover ? "in-studio-only" : "connect";
      button.appendChild(badge);
      button.addEventListener("click", () => {
        if (!seat.cutover) {
          handlers.onConnectSeat(seat);
          return;
        }
        state.selectedSeat = seat.id;
        renderSeats(els, state, handlers);
        renderThread(els, state, handlers);
      });
      els.seatList.appendChild(button);
    }
  }

  function renderThread(els, state, handlers) {
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
    if (seat.id === "human" && !anyBotConnected(state)) {
      const empty = document.createElement("div");
      empty.className = "empty-cta";
      empty.id = "connect-seat-cta";
      const copy = document.createElement("p");
      copy.textContent = "Connect a seat to start. GitHub plus one AI seat is enough to see the Board.";
      const start = document.createElement("button");
      start.type = "button";
      start.textContent = "Connect a seat to start";
      start.addEventListener("click", () => {
        const bot = firstUnconnectedBot(state);
        if (bot) {
          handlers.onConnectSeat(bot);
        }
      });
      empty.append(copy, start);
      els.messages.appendChild(empty);
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
