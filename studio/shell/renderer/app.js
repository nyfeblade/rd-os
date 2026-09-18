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
    { id: "slack", label: "Slack", status: "needs_auth" },
  ];

  const els = {
    main: document.getElementById("main"),
    modeChip: document.getElementById("mode-chip"),
    withEl: document.getElementById("with"),
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
    composeSend: document.getElementById("compose-send"),
    inboxCtx: document.getElementById("inbox-ctx"),
    composeHint: document.getElementById("compose-hint"),
    fileTree: document.getElementById("file-tree"),
    editorTab: document.getElementById("editor-tab"),
    editorBody: document.getElementById("editor-body"),
    boardBody: document.getElementById("board-body"),
    cutoverSheet: document.getElementById("cutover-sheet"),
    cutoverTitle: document.getElementById("cutover-title"),
    cutoverCopy: document.getElementById("cutover-copy"),
    cutoverCancel: document.getElementById("cutover-cancel"),
    cutoverConfirm: document.getElementById("cutover-confirm"),
    chatLive: document.getElementById("chat-live"),
    chatCold: document.getElementById("chat-cold"),
    chatOnboard: document.getElementById("chat-onboard"),
    viewLive: document.getElementById("view-live"),
    viewCold: document.getElementById("view-cold"),
    ctaGithub: document.getElementById("cta-github"),
    ctaSeat: document.getElementById("cta-seat"),
    threadMeter: document.getElementById("thread-meter"),
    boardMeter: document.getElementById("board-meter"),
  };

  const state = {
    seats: Studio.panes.coldOpenSeats(),
    connectors: FALLBACK_P0.map((item) => ({ ...item })),
    catalogRows: FALLBACK_P0.map((item) => ({ ...item })),
    inbox: [],
    inboxFilter: null,
    outbox: [],
    boundTo: null,
    pendingBotSend: null,
    selectedSeat: "human",
    selectedFile: "shell",
    dump: null,
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    codeOpen: false,
    mode: "eng",
    view: "cold",
    tokens: { session: null, board: null },
  };

  function bindInbox(id) {
    state.boundTo = id;
    const item = (state.inbox || []).find((row) => row.id === id);
    if (item) {
      state.inboxFilter = item.provider;
    }
    renderChrome();
  }

  const chatHandlers = {
    onConnectSeat(seat) {
      openCutover({
        kind: "seat",
        id: seat.id,
        title: `Connect ${seat.name}`,
        copy: "This seat works in Studio only while connected.",
      });
    },
    bindInbox,
  };

  const boardHandlers = {
    resolveGate,
    resolveBotSend,
    bindInbox,
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

  function onMode(mode) {
    state.mode = mode;
    renderChrome();
  }

  function renderWith() {
    const bound = Studio.panes.boundItem(state);
    if (state.view === "cold") {
      els.withEl.textContent = "";
      return;
    }
    if (bound) {
      els.withEl.textContent = bound.provider === "github" ? "GitHub" : "Slack";
      return;
    }
    const seat = Studio.panes.selectedSeat(state);
    els.withEl.textContent = seat ? seat.name : "";
  }

  function renderChrome() {
    renderWith();
    Studio.chrome.renderMode(els, state, onMode);
    Studio.chrome.renderConnectors(els, state, onConnector);
    Studio.chrome.renderPresence(els, state);
    Studio.panes.renderSeats(els, state, chatHandlers);
    Studio.panes.renderThread(els, state, chatHandlers);
    Studio.panes.renderBoard(els, state, boardHandlers);
    if (Studio.chrome.renderTokenMeters) {
      Studio.chrome.renderTokenMeters(els, state);
    }
  }

  function ensureWire(rows) {
    const next = rows.map((row) => ({ ...row }));
    if (!next.some((row) => row.id === "slack")) {
      next.push({ id: "slack", label: "Slack", status: "needs_auth" });
    }
    if (!next.some((row) => row.id === "github")) {
      next.push({ id: "github", label: "GitHub", status: "needs_auth" });
    }
    return next;
  }

  function connectorStatus(id) {
    const row = state.connectors.find((item) => item.id === id);
    return row ? row.status : "needs_auth";
  }

  function cutoverFromSeats() {
    const attached = state.seats.some((seat) => seat.kind === "bot" && seat.cutover === true);
    return { status: attached ? "attached" : "unattached", in_studio_only: attached };
  }

  function applyLiveDemo() {
    state.seats = Studio.panes.coldOpenSeats().map((seat) => {
      if (seat.id === "human" || seat.id === "cursor" || seat.id === "claude") {
        return { ...seat, presence: "online", cutover: true };
      }
      return { ...seat };
    });
    state.selectedSeat = "cursor";
    state.connectors = ensureWire(state.catalogRows).map((row) => {
      const next = { ...row };
      switch (row.id) {
        case "slack":
          next.status = "needs_auth";
          break;
        default:
          next.status = "live";
      }
      return next;
    });
    state.tokens = { session: 840, board: 210 };
  }

  function clearTwoWay() {
    state.inbox = [];
    state.inboxFilter = null;
    state.outbox = [];
    state.boundTo = null;
    state.pendingBotSend = null;
    state.tokens = { session: null, board: null };
  }

  function bindFirstInbox() {
    const github = (state.inbox || []).find((item) => item.provider === "github" && item.need_you);
    const slack = (state.inbox || []).find((item) => item.provider === "slack" && item.need_you);
    state.inboxFilter = github ? "github" : slack ? "slack" : null;
    state.boundTo = github ? github.id : slack ? slack.id : null;
    if (slack) {
      state.pendingBotSend = {
        id: `bot:${slack.id}`,
        provider: "slack",
        bound_to: slack.id,
        kind: Studio.panes.replyKindFor(slack),
        title: "Bot Slack reply (cutover)",
        body: "bot follow-up after human gate",
        thread_ref: slack.thread_ref,
        status: "pending",
      };
      return;
    }
    const bound = Studio.panes.boundItem(state);
    if (bound && connectorStatus(bound.provider) === "live") {
      state.pendingBotSend = {
        id: `bot:${bound.id}`,
        provider: bound.provider,
        bound_to: bound.id,
        kind: Studio.panes.replyKindFor(bound),
        title: `Bot ${bound.provider === "github" ? "GitHub" : "Slack"} reply (cutover)`,
        body: "bot follow-up after human gate",
        thread_ref: bound.thread_ref,
        status: "pending",
      };
    } else {
      state.pendingBotSend = null;
    }
  }

  function setView(view) {
    switch (view) {
      case "cold":
      case "live":
        break;
      default:
        Studio.assertNever(view);
    }
    state.view = view;
    els.viewCold.classList.toggle("on", view === "cold");
    els.viewLive.classList.toggle("on", view === "live");
    els.chatCold.hidden = view !== "cold";
    els.chatLive.hidden = view === "cold";
    if (els.chatOnboard) {
      els.chatOnboard.hidden = view === "live";
    }
    if (view === "cold") {
      state.seats = Studio.panes.coldOpenSeats();
      state.selectedSeat = "human";
      state.connectors = ensureWire(state.catalogRows).map((row) => ({ ...row, status: "needs_auth" }));
      clearTwoWay();
      Studio.panes.setCodeOpen(els, state, false);
    } else {
      applyLiveDemo();
    }
    renderChrome();
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

  async function resolveBotSend(status) {
    switch (status) {
      case "approved":
      case "rejected":
        break;
      default:
        Studio.assertNever(status);
    }
    const pending = state.pendingBotSend;
    if (!pending) {
      return;
    }
    if (status === "rejected") {
      pending.status = "denied";
      state.flash = "bot send denied — no free-fire";
      renderChrome();
      return;
    }
    const result = await postReply({
      provider: pending.provider,
      actor: "bot",
      kind: pending.kind,
      tray_state: connectorStatus(pending.provider),
      bound_to: pending.bound_to,
      body: pending.body,
      thread_ref: pending.thread_ref,
      cutover: cutoverFromSeats(),
      human_gate: { status: "approved", by: "you" },
    });
    if (result && result.ok) {
      pending.status = "sent";
      state.outbox.push({ actor: "bot", body: pending.body, bound_to: pending.bound_to });
      state.flash = "bot send after cutover + human gate";
    } else {
      state.flash = result && result.code ? result.code : "BOT_SEND_NO_GATE";
    }
    renderChrome();
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
      case "live": {
        state.inboxFilter = id;
        const match = (state.inbox || []).find((item) => item.provider === id && item.need_you);
        state.boundTo = match ? match.id : null;
        renderChrome();
        return;
      }
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

  async function postReply(draft) {
    try {
      if (window.studioShell && typeof window.studioShell.reply === "function") {
        return await window.studioShell.reply(draft);
      }
      const response = await fetch("/twoway/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      return await response.json();
    } catch (_err) {
      return { ok: false, code: "INVALID_EVENT" };
    }
  }

  function wireChrome() {
    els.viewCold.addEventListener("click", () => {
      setView("cold");
      loadNamedDump("attention.empty.json").then(() => renderChrome());
    });
    els.viewLive.addEventListener("click", () => {
      setView("live");
      Promise.all([loadNamedDump("attention.human.json"), loadInbox()]).then(() => {
        bindFirstInbox();
        renderChrome();
      });
    });
    els.ctaGithub.addEventListener("click", () => onConnector("github"));
    els.ctaSeat.addEventListener("click", () => {
      const bot = state.seats.find((seat) => seat.kind === "bot" && !seat.cutover);
      if (bot) {
        chatHandlers.onConnectSeat(bot);
      }
    });
    els.btnCode.addEventListener("click", () => {
      Studio.panes.setCodeOpen(els, state, !state.codeOpen);
      Studio.panes.renderBoard(els, state, boardHandlers);
    });
    if (els.hintCode) {
      els.hintCode.addEventListener("click", () => {
        Studio.panes.setCodeOpen(els, state, true);
        Studio.panes.renderBoard(els, state, boardHandlers);
      });
    }
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
      const bound = Studio.panes.boundItem(state);
      if (bound) {
        postReply({
          provider: bound.provider,
          actor: "human",
          kind: Studio.panes.replyKindFor(bound),
          tray_state: connectorStatus(bound.provider),
          bound_to: bound.id,
          body: text,
          thread_ref: bound.thread_ref,
        }).then((result) => {
          if (result && result.ok) {
            state.outbox.push({ actor: "human", body: text, bound_to: bound.id });
            state.flash = "sent from Studio on this thread";
          } else if (result && result.code === "UNBOUND_REPLY") {
            state.flash = "UNBOUND_REPLY";
          } else {
            state.flash = result && result.code ? result.code : "reply failed";
          }
          els.composerInput.value = "";
          renderChrome();
        });
        return;
      }
      const seat = Studio.panes.selectedSeat(state);
      Studio.panes.pushLocal(seat.id, { who: "You", body: text, me: true });
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
    return query.get("fixture") === "human" || query.get("view") === "live"
      ? "attention.human.json"
      : "attention.empty.json";
  }

  function initialView() {
    const query = new URLSearchParams(window.location.search);
    return query.get("fixture") === "human" || query.get("view") === "live" ? "live" : "cold";
  }

  async function loadNamedDump(name) {
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

  async function loadDump() {
    await loadNamedDump(dumpName());
  }

  async function loadInbox() {
    try {
      if (window.studioShell && typeof window.studioShell.loadInbox === "function") {
        const items = await window.studioShell.loadInbox();
        state.inbox = Array.isArray(items) ? items : [];
        return;
      }
      const response = await fetch("/twoway/inbox.json");
      if (!response.ok) {
        state.inbox = [];
        return;
      }
      const items = await response.json();
      state.inbox = Array.isArray(items) ? items : [];
    } catch (_err) {
      state.inbox = [];
    }
  }

  async function loadCatalog() {
    try {
      if (window.studioShell && typeof window.studioShell.loadCatalog === "function") {
        const rows = await window.studioShell.loadCatalog();
        if (Array.isArray(rows) && rows.length) {
          state.catalogRows = ensureWire(
            rows.map((row) => ({
              id: row.id,
              label: row.label,
              status: "needs_auth",
            })),
          );
          state.connectors = state.catalogRows.map((row) => ({ ...row }));
        }
        return;
      }
      const response = await fetch("./catalog.json");
      if (!response.ok) {
        return;
      }
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length) {
        state.catalogRows = ensureWire(
          rows.map((row) => ({
            id: row.id,
            label: row.label,
            status: "needs_auth",
          })),
        );
        state.connectors = state.catalogRows.map((row) => ({ ...row }));
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
    if (initialView() === "live") {
      await loadInbox();
    }
    setView(initialView());
    if (state.view === "live") {
      bindFirstInbox();
      renderChrome();
    }
    wireChrome();
  }

  boot();
})();
