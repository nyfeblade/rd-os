"use strict";

(() => {
  const Studio = globalThis.StudioShell;
  const host = window.studioShell ? "electron" : "preview";
  document.body.dataset.host = host;

  const FALLBACK_P0 = [
    { id: "github", label: "GitHub", status: "needs_auth" },
    { id: "cursor", label: "Cursor", status: "needs_auth" },
    { id: "claude", label: "Claude", status: "needs_auth" },
    { id: "grok", label: "Grok", status: "needs_auth" },
    { id: "linear", label: "Linear", status: "needs_auth" },
    { id: "sentry", label: "Sentry", status: "needs_auth" },
    { id: "vercel", label: "Vercel", status: "needs_auth" },
  ];

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
    seats: Studio.panes.coldOpenSeats(),
    connectors: FALLBACK_P0.map((item) => ({ ...item })),
    selectedSeat: "human",
    selectedFile: "shell",
    dump: null,
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    codeOpen: false,
    mode: "eng",
  };

  const chatHandlers = {
    onConnectSeat(seat) {
      openCutover({
        kind: "seat",
        id: seat.id,
        title: `Connect ${seat.name}`,
        copy: "This seat works in Studio only while connected.",
      });
    },
  };

  const boardHandlers = {
    resolveGate,
    openDiff() {
      Studio.panes.setCodeOpen(els, state, true);
      Studio.panes.renderBoard(els, state, boardHandlers);
    },
  };

  function setPresenceOpen(open) {
    state.presenceOpen = open;
    els.presenceBtn.setAttribute("aria-expanded", String(open));
    els.presenceList.hidden = !open;
  }

  function renderChrome() {
    Studio.chrome.renderMode(els, state);
    Studio.chrome.renderConnectors(els, state, onConnector);
    Studio.chrome.renderPresence(els, state);
    Studio.panes.renderSeats(els, state, chatHandlers);
    Studio.panes.renderThread(els, state, chatHandlers);
    Studio.panes.renderBoard(els, state, boardHandlers);
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
        Studio.assertNever(action);
    }
    if (state.dump && state.dump.p0) {
      state.dump = {
        ...state.dump,
        p0: null,
        open_gates: [],
      };
    }
    Studio.panes.renderBoard(els, state, boardHandlers);
  }

  function onConnector(id) {
    if (id === "add") {
      openCutover({
        kind: "connector",
        id: "add",
        title: "Connect a provider",
        copy: "Connect GitHub / an agent provider. This seat works in Studio only while connected.",
      });
      return;
    }
    const connector = state.connectors.find((item) => item.id === id);
    if (!connector) {
      return;
    }
    switch (connector.status) {
      case "live":
        return;
      case "needs_auth":
      case "disconnected":
      case "error":
        openCutover({
          kind: "connector",
          id: connector.id,
          title: `Connect ${connector.label}`,
          copy: "This seat works in Studio only while connected.",
        });
        return;
      default:
        Studio.assertNever(connector.status);
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
            connector.status = "live";
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
        Studio.assertNever(pending.kind);
    }
    closeCutover();
    renderChrome();
  }

  function wireChrome() {
    els.modeChip.addEventListener("click", () => {
      state.mode = Studio.chrome.nextMode(state.mode);
      Studio.chrome.renderMode(els, state);
    });
    els.btnCode.addEventListener("click", () => {
      Studio.panes.setCodeOpen(els, state, !state.codeOpen);
      Studio.panes.renderBoard(els, state, boardHandlers);
    });
    els.hintCode.addEventListener("click", () => {
      Studio.panes.setCodeOpen(els, state, true);
      Studio.panes.renderBoard(els, state, boardHandlers);
    });
    els.btnClose.addEventListener("click", () => {
      Studio.panes.setCodeOpen(els, state, false);
      Studio.panes.renderBoard(els, state, boardHandlers);
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
      const seat = Studio.panes.selectedSeat(state);
      Studio.panes.pushLocal(seat.id, { who: "You", body: text, me: true });
      Studio.panes.pushLocal(seat.id, {
        who: seat.name,
        body: "Placeholder seat. Model attach is later. Still in Studio only.",
        me: false,
      });
      els.composerInput.value = "";
      Studio.panes.renderThread(els, state, chatHandlers);
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
      if (event.key !== "Escape") {
        return;
      }
      if (!els.cutoverSheet.hidden) {
        closeCutover();
        return;
      }
      if (state.codeOpen) {
        Studio.panes.setCodeOpen(els, state, false);
        Studio.panes.renderBoard(els, state, boardHandlers);
      }
    });
  }

  function dumpName() {
    const query = new URLSearchParams(window.location.search);
    return query.get("fixture") === "human" ? "attention.human.json" : "attention.empty.json";
  }

  async function loadDump() {
    const name = dumpName();
    try {
      if (window.studioShell && typeof window.studioShell.loadDump === "function") {
        state.dump = await window.studioShell.loadDump(name);
        return;
      }
      const response = await fetch(`./fixtures/${name}`);
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      state.dump = await response.json();
    } catch (_err) {
      state.dump = null;
    }
  }

  async function loadCatalog() {
    try {
      if (window.studioShell && typeof window.studioShell.loadCatalog === "function") {
        const rows = await window.studioShell.loadCatalog();
        if (Array.isArray(rows) && rows.length) {
          state.connectors = rows.map((row) => ({
            id: row.id,
            label: row.label,
            status: "needs_auth",
          }));
        }
        return;
      }
      const response = await fetch("./catalog.json");
      if (!response.ok) {
        return;
      }
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length) {
        state.connectors = rows.map((row) => ({
          id: row.id,
          label: row.label,
          status: "needs_auth",
        }));
      }
    } catch (_err) {
      state.connectors = FALLBACK_P0.map((item) => ({ ...item }));
    }
  }

  async function boot() {
    if (window.studioShell && typeof window.studioShell.platform === "function") {
      const platform = await window.studioShell.platform();
      document.body.dataset.platform = platform;
    }

    await loadCatalog();
    await loadDump();
    Studio.panes.setCodeOpen(els, state, false);
    renderChrome();
    wireChrome();
  }

  boot();
})();
