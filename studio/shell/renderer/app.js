"use strict";

(() => {
  const host = window.studioShell ? "electron" : "preview";
  document.body.dataset.host = host;

  const SEATS = [
    {
      id: "eng-lead",
      name: "Eng Lead",
      kind: "seat",
      presence: "online",
      cutover: true,
    },
    {
      id: "designer",
      name: "Studio Designer",
      kind: "seat",
      presence: "online",
      cutover: true,
    },
    {
      id: "rd-os",
      name: "#rd-os",
      kind: "room",
      presence: "offline",
      cutover: false,
    },
  ];

  const HUMAN = {
    id: "you",
    name: "you",
    kind: "human",
    presence: "online",
    cutover: true,
  };

  const FILES = [
    {
      id: "main",
      tree: "electron/main.js",
      tab: "main.js",
      body: `const win = new BrowserWindow({\n  width: 1440,\n  height: 900,\n  minWidth: 1200,\n  minHeight: 720,\n  title: "AI Coding Studio",\n});\n\n// Chat | Code | Board stay mounted.\n// Board consumes attention.dump later — no kernel ownership.\n`,
    },
    {
      id: "shell",
      tree: "renderer/index.html",
      tab: "index.html",
      body: `<main class="panes">\n  <section data-pane="chat">…</section>\n  <section data-pane="code">…</section>\n  <section data-pane="board">…</section>\n</main>\n`,
    },
    {
      id: "board",
      tree: "renderer/app.js",
      tab: "app.js",
      body: `// Board pane owns gates. Chat stays seats. Code stays repos.\n// Waiting-table-as-home is dead.\n`,
    },
  ];

  const THREADS = {
    "eng-lead": [
      {
        who: "Eng Lead · 8:01",
        body: "Three-pane SoT supersedes Waiting-home. Board pane owns gates.",
      },
      {
        who: "you",
        body: "Chat stays seats. Code stays repos. in-studio-only on cutover seats.",
      },
    ],
    designer: [
      {
        who: "Studio Designer · 8:04",
        body: "Dark immersive chrome. Connectors tray + presence stay in the titlebar.",
      },
    ],
    "rd-os": [
      {
        who: "#rd-os",
        body: "Room is offline. Connect to cut over — work happens in Studio only.",
      },
    ],
  };

  const els = {
    connectors: document.getElementById("connectors-tray"),
    presenceBtn: document.getElementById("presence-btn"),
    presenceCount: document.getElementById("presence-count"),
    presenceList: document.getElementById("presence-list"),
    seatList: document.getElementById("seat-list"),
    messages: document.getElementById("messages"),
    composer: document.getElementById("composer"),
    composerInput: document.getElementById("composer-input"),
    fileTree: document.getElementById("file-tree"),
    editorTabs: document.getElementById("editor-tabs"),
    editorBody: document.getElementById("editor-body"),
    boardBody: document.getElementById("board-body"),
    boardFoot: document.getElementById("board-foot"),
    cutoverSheet: document.getElementById("cutover-sheet"),
    cutoverTitle: document.getElementById("cutover-title"),
    cutoverCopy: document.getElementById("cutover-copy"),
    cutoverCancel: document.getElementById("cutover-cancel"),
    cutoverConfirm: document.getElementById("cutover-confirm"),
    panes: document.getElementById("panes"),
    splitLeft: document.getElementById("split-left"),
    splitRight: document.getElementById("split-right"),
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
    selectedFile: "main",
    dump: null,
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    paneWidths: null,
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
        return "Human";
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
    return [HUMAN, ...state.seats].filter((member) => member.presence === "online");
  }

  function selectedSeat() {
    return state.seats.find((seat) => seat.id === state.selectedSeat) || state.seats[0];
  }

  function selectedFile() {
    return FILES.find((file) => file.id === state.selectedFile) || FILES[0];
  }

  function renderConnectors() {
    els.connectors.replaceChildren();
    for (const connector of state.connectors) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = connectorClass(connector.status);
      button.dataset.connector = connector.id;
      button.textContent = connector.label;
      if (connector.status === "connected") {
        button.setAttribute("aria-pressed", "true");
        button.title = `${connector.label} connected`;
      } else if (connector.status === "needs-auth") {
        button.title = `${connector.label} needs auth`;
      }
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
  }

  function renderPresence() {
    const online = onlineMembers();
    els.presenceCount.textContent = `${online.length} online`;
    els.presenceBtn.setAttribute("aria-expanded", String(state.presenceOpen));
    els.presenceList.hidden = !state.presenceOpen;
    els.presenceList.replaceChildren();

    const members = [HUMAN, ...state.seats];
    for (const member of members) {
      const row = document.createElement("div");
      row.className = "presence-row";
      row.setAttribute("role", "listitem");
      const dot = document.createElement("i");
      dot.className = `dot ${presenceDotClass(member.presence)}`;
      const name = document.createElement("span");
      name.textContent = member.name;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = member.cutover && member.presence === "online" ? "in-studio-only" : member.presence;
      row.append(dot, name, meta);
      els.presenceList.appendChild(row);
    }
  }

  function renderSeats() {
    els.seatList.replaceChildren();
    for (const seat of state.seats) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = seat.id === state.selectedSeat ? "seat active" : "seat";
      button.dataset.seat = seat.id;
      const name = document.createElement("div");
      name.className = "n";
      const dot = document.createElement("i");
      if (presenceDotClass(seat.presence)) {
        dot.className = presenceDotClass(seat.presence);
      }
      name.append(dot, document.createTextNode(seat.name));
      button.appendChild(name);
      if (seat.cutover) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = "in-studio-only";
        button.appendChild(pill);
      } else {
        const connect = document.createElement("span");
        connect.className = "pill";
        connect.textContent = "connect";
        button.appendChild(connect);
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
      wrap.className = "msg";
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = message.who;
      const body = document.createElement("div");
      body.className = "b";
      body.textContent = message.body;
      wrap.append(who, body);
      els.messages.appendChild(wrap);
    }
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function renderCode() {
    const current = selectedFile();
    els.fileTree.replaceChildren();
    const repo = document.createElement("div");
    repo.className = "repo";
    repo.textContent = "nyfeblade/rd-os";
    els.fileTree.appendChild(repo);
    const root = document.createElement("div");
    root.textContent = "studio/shell/";
    els.fileTree.appendChild(root);
    for (const file of FILES) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = file.id === current.id ? "tree-item on" : "tree-item";
      item.textContent = `└ ${file.tree}`;
      item.addEventListener("click", () => {
        state.selectedFile = file.id;
        renderCode();
      });
      els.fileTree.appendChild(item);
    }

    els.editorTabs.replaceChildren();
    for (const file of FILES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = file.id === current.id ? "tab on" : "tab";
      tab.textContent = file.tab;
      tab.addEventListener("click", () => {
        state.selectedFile = file.id;
        renderCode();
      });
      els.editorTabs.appendChild(tab);
    }
    els.editorBody.textContent = current.body;
  }

  function boardRows(dump) {
    if (!dump || !dump.p0) {
      return [];
    }
    const rows = [
      {
        id: dump.p0.id,
        what: dump.p0.why,
        waitingOn: dump.p0.waiting_on,
        ageS: dump.p0.age_s,
      },
    ];
    if (dump.p0.waiting_on === "human") {
      rows.push(
        { id: "proof-checks", what: "PR checks", waitingOn: "proof", ageS: 240 },
        { id: "agent-impl", what: "Studio shell implement", waitingOn: "agent", ageS: 3600 },
      );
    }
    return rows;
  }

  function renderBoard() {
    const dump = state.dump;
    els.boardBody.replaceChildren();

    if (!dump) {
      els.boardBody.innerHTML = `<div class="quiet" style="padding:16px">Can't reach the board stub.</div>`;
      els.boardFoot.textContent = "Board is a view. No kernel ownership.";
      return;
    }

    if (!dump.p0) {
      els.boardBody.innerHTML = `<div class="quiet" style="padding:16px">Nothing on the board. Chat and Code stay open.</div>`;
      els.boardFoot.textContent = "Open gates: none · stub · attention.dump / MCP later";
      return;
    }

    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>What</th><th>On</th><th>Age</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    for (const row of boardRows(dump)) {
      const tr = document.createElement("tr");
      if (row.waitingOn === "human") {
        tr.className = "human";
      }
      const what = document.createElement("td");
      if (row.waitingOn !== "human") {
        what.className = "quiet";
      }
      what.append(document.createTextNode(row.what));
      if (row.waitingOn === "human") {
        const actions = document.createElement("div");
        actions.className = "actions";
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "p";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => resolveGate("approve"));
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "s";
        reject.textContent = "Reject";
        reject.addEventListener("click", () => resolveGate("reject"));
        actions.append(approve, reject);
        what.appendChild(actions);
      }
      const on = document.createElement("td");
      on.className = row.waitingOn === "human" ? "" : "quiet";
      on.textContent = waitingLabel(row.waitingOn);
      const age = document.createElement("td");
      age.className = row.waitingOn === "human" ? "" : "quiet";
      age.textContent = formatAge(row.ageS);
      tr.append(what, on, age);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.boardBody.appendChild(table);

    const gates = dump.open_gates && dump.open_gates.length ? dump.open_gates.join(" · ") : "none";
    const cutoverCount = state.seats.filter((seat) => seat.cutover).length;
    const flash = state.flash ? ` · ${state.flash}` : "";
    els.boardFoot.textContent = `Open gates: ${gates} · in-studio-only cutover on ${cutoverCount} seats · stub · attention.dump / MCP later${flash}`;
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
        if (pending.id === "add") {
          state.flash = "more connectors later";
          break;
        }
        const connector = state.connectors.find((item) => item.id === pending.id);
        if (connector) {
          connector.status = "connected";
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
    renderBoard();
  }

  function wireComposer() {
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
      THREADS[seat.id].push({ who: "you", body: text });
      THREADS[seat.id].push({
        who: `${seat.name} · stub`,
        body: "Placeholder seat. Model attach is later. Still in Studio only.",
      });
      els.composerInput.value = "";
      renderThread();
    });
  }

  function wirePresence() {
    els.presenceBtn.addEventListener("click", () => {
      state.presenceOpen = !state.presenceOpen;
      renderPresence();
    });
    document.addEventListener("click", (event) => {
      if (!els.presenceBtn.contains(event.target) && !els.presenceList.contains(event.target)) {
        if (state.presenceOpen) {
          state.presenceOpen = false;
          renderPresence();
        }
      }
    });
  }

  function wireCutover() {
    els.cutoverCancel.addEventListener("click", closeCutover);
    els.cutoverConfirm.addEventListener("click", confirmCutover);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.cutoverSheet.hidden) {
        closeCutover();
      }
    });
  }

  function wireSplitters() {
    const panes = els.panes;

    function applyWidths(chat, code, board) {
      const chatW = Math.max(280, chat);
      const boardW = Math.max(280, board);
      const codeW = Math.max(360, code);
      panes.style.gridTemplateColumns = `${chatW}px 5px ${codeW}px 5px ${boardW}px`;
    }

    function startDrag(which, event) {
      event.preventDefault();
      const startX = event.clientX;
      const chat = document.getElementById("pane-chat");
      const code = document.getElementById("pane-code");
      const board = document.getElementById("pane-board");
      const start = {
        chat: chat.getBoundingClientRect().width,
        code: code.getBoundingClientRect().width,
        board: board.getBoundingClientRect().width,
      };

      function move(moveEvent) {
        const dx = moveEvent.clientX - startX;
        if (which === "left") {
          applyWidths(start.chat + dx, start.code - dx, start.board);
          return;
        }
        applyWidths(start.chat, start.code + dx, start.board - dx);
      }

      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    els.splitLeft.addEventListener("pointerdown", (event) => startDrag("left", event));
    els.splitRight.addEventListener("pointerdown", (event) => startDrag("right", event));
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
    renderConnectors();
    renderPresence();
    renderSeats();
    renderThread();
    renderCode();
    renderBoard();
    wireComposer();
    wirePresence();
    wireCutover();
    wireSplitters();
  }

  boot();
})();
