"use strict";

(() => {
  const host = window.studioShell ? "electron" : "preview";
  document.body.dataset.host = host;

  const SEATS = [
    { id: "eng-lead", name: "Eng Lead", kind: "seat", presence: "online", cutover: true },
    { id: "you", name: "You", kind: "human", presence: "online", cutover: true },
    { id: "designer", name: "Studio Designer", kind: "seat", presence: "online", cutover: true },
    { id: "rd-os", name: "#rd-os", kind: "room", presence: "offline", cutover: false },
  ];

  const FILES = [
    {
      id: "shell",
      tab: "StudioShell.tsx",
      body: "// only here when you asked\nexport function StudioShell() {\n  return <ChatAndBoard />\n}\n",
    },
    {
      id: "board",
      tab: "BoardPane.tsx",
      body: "// gates live on the board — not a Waiting home\nexport function BoardPane() {\n  return <Gates />\n}\n",
    },
  ];

  const THREADS = {
    "eng-lead": [
      { who: "Eng Lead", body: "Studio is the eng desk — CloudAgent and Proof live on the Board. Not a life OS.", me: false },
      { who: "You", body: "Chat + gates by default. Code only when a diff matters.", me: true },
    ],
    you: [{ who: "You", body: "Notes stay here. Code stays closed until a file matters.", me: true }],
    designer: [{ who: "Studio Designer", body: "Quiet chrome. Code stays away until a diff matters.", me: false }],
    "rd-os": [{ who: "#rd-os", body: "Room is offline. Connect to cut over — work happens in Studio only.", me: false }],
  };

  const els = {
    main: document.getElementById("main"),
    modeChip: document.getElementById("mode-chip"),
    btnCode: document.getElementById("btn-code"),
    hintCode: document.getElementById("hint-code"),
    btnClose: document.getElementById("btn-close"),
    codePane: document.getElementById("pane-code"),
    codeHint: document.getElementById("open-code-hint"),
    presenceBtn: document.getElementById("presence-btn"),
    presenceCount: document.getElementById("presence-count"),
    presenceList: document.getElementById("presence-list"),
    connectors: document.getElementById("connectors-tray"),
    instruments: document.getElementById("instruments"),
    watches: document.getElementById("watches"),
    seatList: document.getElementById("seat-list"),
    messages: document.getElementById("messages"),
    composer: document.getElementById("composer"),
    composerInput: document.getElementById("composer-input"),
    fileTree: document.getElementById("file-tree"),
    editorTab: document.getElementById("editor-tab"),
    editorBody: document.getElementById("editor-body"),
    boardBody: document.getElementById("board-body"),
    cutoverSheet: document.getElementById("cutover-sheet"),
    cutoverTitle: document.getElementById("cutover-title"),
    cutoverCopy: document.getElementById("cutover-copy"),
    cutoverCancel: document.getElementById("cutover-cancel"),
    cutoverConfirm: document.getElementById("cutover-confirm"),
  };

  const state = {
    seats: SEATS.map((seat) => ({ ...seat })),
    connectors: [
      { id: "github", label: "GitHub", status: "connected" },
      { id: "cloudagent", label: "CloudAgent", status: "connected" },
      { id: "notion", label: "Notion", status: "needs-auth" },
      { id: "add", label: "+ connector", status: "add" },
    ],
    selectedSeat: "eng-lead",
    selectedFile: "shell",
    dump: null,
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    codeOpen: false,
    mode: "build",
  };

  function assertNever(value) {
    throw new Error(`unhandled variant: ${value}`);
  }

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

  function connectorClass(status) {
    switch (status) {
      case "connected":
        return "chip on";
      case "needs-auth":
        return "chip";
      case "add":
        return "chip";
      default:
        return assertNever(status);
    }
  }

  function waitingLabel(who) {
    switch (who) {
      case "human":
        return "You";
      case "agent":
        return "CloudAgent";
      case "proof":
        return "Proof";
      default:
        return assertNever(who);
    }
  }

  function modeLabel(mode) {
    switch (mode) {
      case "build":
        return "build";
      case "proof":
        return "proof";
      case "integrate":
        return "integrate";
      default:
        return assertNever(mode);
    }
  }

  function nextMode(mode) {
    switch (mode) {
      case "build":
        return "proof";
      case "proof":
        return "integrate";
      case "integrate":
        return "build";
      default:
        return assertNever(mode);
    }
  }

  function instrumentFor(kind, dump) {
    const who = dump && dump.p0 ? dump.p0.waiting_on : null;
    switch (kind) {
      case "ca":
        if (who === "agent") {
          return { label: "CloudAgent", state: "running", detail: "nyfeblade/rd-os · PR#11" };
        }
        return { label: "CloudAgent", state: "idle", detail: "nyfeblade/rd-os · no run" };
      case "proof":
        if (who === "proof") {
          return { label: "Proof", state: "checking", detail: "Eng Proof · dual-gate" };
        }
        if (who === "human") {
          return { label: "Proof", state: "ready", detail: "checks in · PR#11" };
        }
        return { label: "Proof", state: "idle", detail: "no packet" };
      default:
        return assertNever(kind);
    }
  }

  function formatAge(ageS) {
    const minutes = Math.max(0, Math.floor(ageS / 60));
    if (minutes < 60) {
      return `${Math.max(1, minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function onlineMembers() {
    return state.seats.filter((member) => member.presence === "online");
  }

  function selectedSeat() {
    return state.seats.find((seat) => seat.id === state.selectedSeat) || state.seats[0];
  }

  function selectedFile() {
    return FILES.find((file) => file.id === state.selectedFile) || FILES[0];
  }

  function setCodeOpen(open) {
    state.codeOpen = open;
    els.main.classList.toggle("code-open", open);
    els.codePane.hidden = !open;
    els.btnCode.classList.toggle("on", open);
    els.btnCode.setAttribute("aria-pressed", open ? "true" : "false");
    els.codeHint.hidden = open;
    if (open) {
      renderCode();
    }
  }

  function setPresenceOpen(open) {
    state.presenceOpen = open;
    els.presenceBtn.setAttribute("aria-expanded", String(open));
    els.presenceList.hidden = !open;
  }

  function renderPresence() {
    const online = onlineMembers();
    els.presenceCount.textContent = `${online.length} here`;
    els.presenceList.replaceChildren();
    for (const member of state.seats) {
      const row = document.createElement("div");
      row.className = "popover-row";
      row.setAttribute("role", "listitem");
      const dot = document.createElement("i");
      dot.className = `dot ${presenceDotClass(member.presence)}`;
      const name = document.createElement("span");
      name.textContent = member.name;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = member.cutover && member.presence === "online" ? "in studio" : member.presence;
      row.append(dot, name, meta);
      els.presenceList.appendChild(row);
    }
  }

  function renderConnectors() {
    els.connectors.replaceChildren();
    for (const connector of state.connectors) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = connectorClass(connector.status);
      button.dataset.connector = connector.id;
      button.textContent = connector.label;
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
  }

  function renderInstruments() {
    els.instruments.replaceChildren();
    for (const kind of ["ca", "proof"]) {
      const item = instrumentFor(kind, state.dump);
      const card = document.createElement("div");
      card.className = "instrument";
      card.dataset.instrument = kind;
      const k = document.createElement("div");
      k.className = "k";
      k.textContent = item.label;
      const v = document.createElement("div");
      v.className = "v";
      v.textContent = item.state;
      const d = document.createElement("div");
      d.className = "d";
      d.textContent = item.detail;
      card.append(k, v, d);
      els.instruments.appendChild(card);
    }
  }

  function renderMode() {
    els.modeChip.textContent = modeLabel(state.mode);
  }

  function renderWatches() {
    els.watches.replaceChildren();
    const head = document.createElement("div");
    head.className = "k";
    head.textContent = "Watches";
    els.watches.appendChild(head);
    const items = [
      "nightly proof packet",
      "merge-gate age on studio-a-shell",
    ];
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "watch";
      row.textContent = item;
      els.watches.appendChild(row);
    }
  }

  function renderSeats() {
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
      if (seat.cutover) {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = "in studio";
        button.appendChild(badge);
      } else {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = "connect";
        button.appendChild(badge);
      }
      button.addEventListener("click", () => {
        if (!seat.cutover) {
          openCutover({
            kind: "seat",
            id: seat.id,
            title: `Connect ${seat.name}`,
            copy: "This seat works in Studio only while connected.",
          });
          return;
        }
        state.selectedSeat = seat.id;
        renderSeats();
        renderThread();
      });
      els.seatList.appendChild(button);
    }
  }

  function renderThread() {
    const seat = selectedSeat();
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

  function renderCode() {
    const current = selectedFile();
    els.fileTree.replaceChildren();
    for (const file of FILES) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = file.id === current.id ? "tree-item on" : "tree-item";
      item.textContent = file.tab;
      item.addEventListener("click", () => {
        state.selectedFile = file.id;
        renderCode();
      });
      els.fileTree.appendChild(item);
    }
    els.editorTab.replaceChildren();
    const name = document.createElement("b");
    name.textContent = current.tab;
    els.editorTab.appendChild(name);
    els.editorBody.textContent = current.body;
  }

  function boardRows(dump) {
    const rows = [];
    if (dump && dump.p0 && dump.p0.waiting_on === "human") {
      rows.push({
        id: dump.p0.id,
        what: "Merge gate",
        sub: "Studio shell",
        waitingOn: "human",
        ageS: dump.p0.age_s,
      });
    }
    const ca = instrumentFor("ca", dump);
    const proof = instrumentFor("proof", dump);
    rows.push({
      id: "ca",
      what: "CloudAgent",
      sub: ca.detail,
      waitingOn: "agent",
      ageS: dump && dump.p0 && dump.p0.waiting_on === "agent" ? dump.p0.age_s : 0,
    });
    rows.push({
      id: "proof",
      what: "Proof",
      sub: proof.detail,
      waitingOn: "proof",
      ageS: dump && dump.p0 && dump.p0.waiting_on === "proof" ? dump.p0.age_s : 240,
    });
    return rows;
  }

  function renderBoard() {
    const dump = state.dump;
    renderInstruments();
    els.boardBody.replaceChildren();

    if (!dump) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.textContent = "Can't reach the board stub.";
      els.boardBody.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>What</th><th>On</th><th>Age</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const row of boardRows(dump)) {
      const tr = document.createElement("tr");
      if (row.waitingOn === "human") {
        tr.className = "need";
      }
      const what = document.createElement("td");
      if (row.waitingOn !== "human") {
        what.className = "mute";
      }
      const title = document.createElement("div");
      title.className = "what";
      title.textContent = row.what;
      what.appendChild(title);
      if (row.sub) {
        const sub = document.createElement("div");
        sub.className = "sub";
        sub.textContent = row.sub;
        what.appendChild(sub);
      }
      if (row.waitingOn === "human") {
        const acts = document.createElement("div");
        acts.className = "acts";
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "go";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => resolveGate("approve"));
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "no";
        reject.textContent = "Reject";
        reject.addEventListener("click", () => resolveGate("reject"));
        acts.append(approve, reject);
        what.appendChild(acts);
      }
      const on = document.createElement("td");
      on.className = row.waitingOn === "human" ? "" : "mute";
      on.textContent = waitingLabel(row.waitingOn);
      const age = document.createElement("td");
      age.className = row.waitingOn === "human" ? "" : "mute";
      age.textContent = row.ageS > 0 ? formatAge(row.ageS) : "—";
      tr.append(what, on, age);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.boardBody.appendChild(table);

    const gates = dump.open_gates && dump.open_gates.length ? dump.open_gates.join(" · ") : "none";
    const cutoverCount = state.seats.filter((seat) => seat.cutover).length;
    const foot = document.createElement("p");
    foot.className = "foot";
    const codeNote = state.codeOpen ? "Code open on demand" : "Code closed by default";
    const flash = state.flash ? ` · ${state.flash}` : "";
    foot.textContent = `Open gates: ${gates} · in-studio cutover on ${cutoverCount} seats · ${codeNote}${flash}`;
    els.boardBody.appendChild(foot);
  }

  function resolveGate(action) {
    switch (action) {
      case "approve":
        state.flash = "approved locally (stub)";
        break;
      case "reject":
        state.flash = "rejected locally (stub)";
        break;
      default:
        assertNever(action);
    }
    if (state.dump && state.dump.p0) {
      state.dump = {
        ...state.dump,
        p0: null,
        open_gates: [],
      };
    }
    renderBoard();
  }

  function onConnector(id) {
    const connector = state.connectors.find((item) => item.id === id);
    if (!connector) {
      return;
    }
    switch (connector.status) {
      case "connected":
        return;
      case "needs-auth":
        openCutover({
          kind: "connector",
          id: connector.id,
          title: `Connect ${connector.label}`,
          copy: "This seat works in Studio only while connected.",
        });
        return;
      case "add":
        openCutover({
          kind: "connector",
          id: "add",
          title: "Add connector",
          copy: "This seat works in Studio only while connected.",
        });
        return;
      default:
        assertNever(connector.status);
    }
  }

  function openCutover(pending) {
    state.pendingCutover = pending;
    els.cutoverTitle.textContent = pending.title;
    els.cutoverCopy.textContent = pending.copy;
    els.cutoverSheet.hidden = false;
    setPresenceOpen(false);
    els.cutoverConfirm.focus();
  }

  function closeCutover() {
    state.pendingCutover = null;
    els.cutoverSheet.hidden = true;
  }

  function confirmCutover() {
    const pending = state.pendingCutover;
    if (!pending) {
      closeCutover();
      return;
    }
    switch (pending.kind) {
      case "connector": {
        if (pending.id !== "add") {
          const connector = state.connectors.find((item) => item.id === pending.id);
          if (connector) {
            connector.status = "connected";
          }
        }
        break;
      }
      case "seat": {
        const seat = state.seats.find((item) => item.id === pending.id);
        if (seat) {
          seat.presence = "online";
          seat.cutover = true;
          state.selectedSeat = seat.id;
        }
        break;
      }
      default:
        assertNever(pending.kind);
    }
    closeCutover();
    renderConnectors();
    renderPresence();
    renderSeats();
    renderThread();
    renderBoard();
  }

  function wireChrome() {
    els.modeChip.addEventListener("click", () => {
      state.mode = nextMode(state.mode);
      renderMode();
    });
    els.btnCode.addEventListener("click", () => {
      setCodeOpen(!state.codeOpen);
      renderBoard();
    });
    els.hintCode.addEventListener("click", () => {
      setCodeOpen(true);
      renderBoard();
    });
    els.btnClose.addEventListener("click", () => {
      setCodeOpen(false);
      renderBoard();
    });
    els.presenceBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setPresenceOpen(!state.presenceOpen);
    });
    document.addEventListener("click", (event) => {
      if (!els.presenceBtn.contains(event.target) && !els.presenceList.contains(event.target)) {
        if (state.presenceOpen) {
          setPresenceOpen(false);
        }
      }
    });
    els.composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = els.composerInput.value.trim();
      if (!text) {
        return;
      }
      const seat = selectedSeat();
      if (!THREADS[seat.id]) {
        THREADS[seat.id] = [];
      }
      THREADS[seat.id].push({ who: "You", body: text, me: true });
      THREADS[seat.id].push({
        who: seat.name,
        body: "Placeholder seat. Model attach is later. Still in Studio only.",
        me: false,
      });
      els.composerInput.value = "";
      renderThread();
    });
    els.composerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.composer.requestSubmit();
      }
    });
    els.cutoverCancel.addEventListener("click", closeCutover);
    els.cutoverConfirm.addEventListener("click", confirmCutover);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.cutoverSheet.hidden) {
        closeCutover();
      }
    });
  }

  async function loadDump() {
    try {
      if (window.studioShell && typeof window.studioShell.loadDump === "function") {
        state.dump = await window.studioShell.loadDump("attention.human.json");
        return;
      }
      const response = await fetch("./fixtures/attention.human.json");
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      state.dump = await response.json();
    } catch (_err) {
      state.dump = null;
    }
  }

  async function boot() {
    if (window.studioShell && typeof window.studioShell.platform === "function") {
      const platform = await window.studioShell.platform();
      document.body.dataset.platform = platform;
    }

    await loadDump();
    setCodeOpen(false);
    renderMode();
    renderConnectors();
    renderPresence();
    renderSeats();
    renderThread();
    renderWatches();
    renderBoard();
    wireChrome();
  }

  boot();
})();
