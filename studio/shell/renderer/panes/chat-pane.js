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

  const LIVE_THREADS = {
    cursor: [
      { who: "Cursor", body: "Diff is ready when you want it. One Proof gate is waiting on you.", me: false },
      { who: "You", body: "Take the gate when CI is green.", me: true },
    ],
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

  function threadFor(state, seat) {
    if (state.view === "live" && LIVE_THREADS[seat.id]) {
      return LIVE_THREADS[seat.id];
    }
    return THREADS[seat.id] || [];
  }

  function renderSeats(els, _state, _handlers) {
    els.seatList.replaceChildren();
    els.seatList.hidden = true;
    els.seatList.dataset.cutover = "in-studio-only";
    els.seatList.setAttribute("aria-hidden", "true");
  }

  function renderThread(els, state, _handlers) {
    const seat = selectedSeat(state);
    els.composerInput.placeholder = `Message ${seat.name}…`;
    const messages = threadFor(state, seat);
    els.messages.replaceChildren();
    for (const message of messages) {
      const wrap = document.createElement("div");
      wrap.className = "msg";
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = message.who;
      const body = document.createElement("div");
      body.className = "txt";
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
