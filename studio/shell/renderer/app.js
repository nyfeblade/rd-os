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
      { who: "Eng Lead", body: "Coding stays optional — open it when a diff matters.", me: false },
      { who: "You", body: "Default is talk + gates. Not an IDE that never shuts up.", me: true },
    ],
    you: [{ who: "You", body: "Notes stay here. Code stays closed until a file matters.", me: true }],
    designer: [{ who: "Studio Designer", body: "Quiet chrome. Code stays away until a diff matters.", me: false }],
    "rd-os": [{ who: "#rd-os", body: "Room is offline. Connect to cut over — work happens in Studio only.", me: false }],
  };

  const els = {
    main: document.getElementById("main"),
    btnCode: document.getElementById("btn-code"),
    hintCode: document.getElementById("hint-code"),
    btnClose: document.getElementById("btn-close"),
    codePane: document.getElementById("pane-code"),
    codeHint: document.getElementById("open-code-hint"),
    presenceBtn: document.getElementById("presence-btn"),
    presenceCount: document.getElementById("presence-count"),
    presenceList: document.getElementById("presence-list"),
    connectorsBtn: document.getElementById("connectors-btn"),
    connectors: document.getElementById("connectors-tray"),
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
    connectorsOpen: false,
    codeOpen: false,
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

  function connectorMeta(status) {
    switch (status) {
      case "connected":
        return "on";
      case "needs-auth":
        return "needs auth";
      case "add":
        return "";
      default:
        return assertNever(status);
    }
  }

  function waitingLabel(who) {
    switch (who) {
      case "human":
        return "You";
      case "agent":
        return "Agent";
      case "proof":
        return "Proof";
      default:
        return assertNever(who);
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

  function whisperConnectorLabel() {
    const connected = state.connectors.filter((item) => item.status === "connected");
    return connected[0] ? connected[0].label : "Connectors";
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

  function setMenu(which, open) {
    switch (which) {
      case "presence":
        state.presenceOpen = open;
        if (open) {
          state.connectorsOpen = false;
        }
        break;
      case "connectors":
        state.connectorsOpen = open;
        if (open) {
          state.presenceOpen = false;
        }
        break;
      default:
        assertNever(which);
    }
    els.presenceBtn.setAttribute("aria-expanded", String(state.presenceOpen));
    els.connectorsBtn.setAttribute("aria-expanded", String(state.connectorsOpen));
    els.presenceList.hidden = !state.presenceOpen;
    els.connectors.hidden = !state.connectorsOpen;
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
    els.connectorsBtn.textContent = whisperConnectorLabel();
    els.connectors.replaceChildren();
    for (const connector of state.connectors) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "connector-row";
      button.dataset.connector = connector.id;
      const label = document.createElement("span");
      label.textContent = connector.label;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = connectorMeta(connector.status);
      button.append(label, meta);
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
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
    if (!dump || !dump.p0) {
      return [];
    }
    const primary = {
      id: dump.p0.id,
      what: dump.p0.waiting_on === "human" ? "Merge gate" : dump.p0.why,
      sub: dump.p0.waiting_on === "human" ? "Studio shell" : dump.p0.why,
      waitingOn: dump.p0.waiting_on,
      ageS: dump.p0.age_s,
    };
    const rows = [primary];
    if (dump.p0.waiting_on === "human") {
      rows.push({ id: "proof-checks", what: "PR checks", sub: "", waitingOn: "proof", ageS: 240 });
    }
    return rows;
  }

  function renderBoard() {
    const dump = state.dump;
    els.boardBody.replaceChildren();

    if (!dump) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.textContent = "Can't reach the board stub.";
      els.boardBody.appendChild(empty);
      return;
    }

    if (!dump.p0) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.textContent = state.flash || "Nothing on the board. Chat stays open.";
      els.boardBody.appendChild(empty);
      const note = document.createElement("p");
      note.className = "foot";
      note.textContent = "Code closed by default";
      els.boardBody.appendChild(note);
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
      age.textContent = formatAge(row.ageS);
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
        setMenu("connectors", false);
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
    setMenu("connectors", false);
    setMenu("presence", false);
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
      setMenu("presence", !state.presenceOpen);
    });
    els.connectorsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenu("connectors", !state.connectorsOpen);
    });
    document.addEventListener("click", (event) => {
      if (!els.presenceBtn.contains(event.target) && !els.presenceList.contains(event.target)) {
        if (state.presenceOpen) {
          setMenu("presence", false);
        }
      }
      if (!els.connectorsBtn.contains(event.target) && !els.connectors.contains(event.target)) {
        if (state.connectorsOpen) {
          setMenu("connectors", false);
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
    renderConnectors();
    renderPresence();
    renderSeats();
    renderThread();
    renderBoard();
    wireChrome();
  }

  boot();
})();
