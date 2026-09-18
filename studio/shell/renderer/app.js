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
    bindStatus: document.getElementById("bind-status"),
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
    cutoverError: document.getElementById("cutover-error"),
    seatProviders: document.getElementById("seat-providers"),
    toast: document.getElementById("shell-toast"),
    chatLive: document.getElementById("chat-live"),
    chatCold: document.getElementById("chat-cold"),
    chatOnboard: document.getElementById("chat-onboard"),
    ctaGithub: document.getElementById("cta-github"),
    ctaSeat: document.getElementById("cta-seat"),
    threadMeter: document.getElementById("thread-meter"),
    boardMeter: document.getElementById("board-meter"),
    seatMeters: document.getElementById("seat-meters"),
    cutoverChip: document.getElementById("cutover-chip"),
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
    pendingHitl: null,
    selectedSeat: "human",
    selectedFile: "shell",
    dump: null,
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    codeOpen: false,
    mode: "eng",
    view: "cold",
    tokens: { session: null, board: null, mission: null, seats: {} },
    engine: {
      ok: false,
      code: null,
      detail: null,
      thread: null,
      snapshot: null,
      messages: [],
      chrome: null,
    },
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
      openAddSeat(seat && seat.id ? seat.id : null);
    },
    bindInbox,
  };

  const boardHandlers = {
    resolveGate,
    resolveBotSend,
    resolveHitl,
    bindInbox,
    openDiff() {
      toggleCode(true);
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

  function renderBind() {
    if (!els.bindStatus) {
      return;
    }
    const chrome = state.engine && state.engine.chrome;
    if (!chrome || !chrome.repo) {
      els.bindStatus.hidden = true;
      els.bindStatus.textContent = "";
      return;
    }
    const parts = [chrome.repo];
    if (chrome.branch) {
      parts.push(chrome.branch);
    }
    if (chrome.dirty) {
      parts.push(chrome.dirty);
    }
    els.bindStatus.hidden = false;
    els.bindStatus.textContent = parts.join(" · ");
  }

  function renderChrome() {
    renderWith();
    renderBind();
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
    state.tokens = {
      session: 840,
      board: 210,
      mission: 210,
      seats: { cursor: 420, claude: 210 },
    };
  }

  function clearTwoWay() {
    state.inbox = [];
    state.inboxFilter = null;
    state.outbox = [];
    state.boundTo = null;
    state.pendingBotSend = null;
    state.pendingHitl = null;
    state.tokens = { session: null, board: null, mission: null, seats: {} };
  }

  function bindFirstInbox() {
    const github = (state.inbox || []).find(
      (item) =>
        item.provider === "github" &&
        item.need_you &&
        (item.kind === "review_request" || item.kind === "review" || item.kind === "review_comment"),
    );
    const slack = (state.inbox || []).find((item) => item.provider === "slack" && item.need_you);
    state.inboxFilter = null;
    state.boundTo = github ? github.id : slack ? slack.id : null;
    state.pendingBotSend = null;
    state.pendingHitl = {
      id: "hitl:deploy:your-repo",
      kind: "deploy",
      title: "Deploy to production (Vercel)",
      destination: "Vercel · production",
      actor: "bot",
      seat: "cursor",
      payload: "project: your-repo\ntarget: production\nactor: Cursor (bot) · in-studio-only",
      diff: "+ vercel.json prod promote\n- preview-only flag",
      status: "pending",
    };
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
    if (els.chatCold) {
      els.chatCold.hidden = view !== "cold";
    }
    if (els.chatLive) {
      els.chatLive.hidden = false;
    }
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

  function resolveHitl(status) {
    switch (status) {
      case "approved":
      case "rejected":
        break;
      default:
        Studio.assertNever(status);
    }
    const pending = state.pendingHitl;
    if (!pending) {
      return;
    }
    if (status === "rejected") {
      pending.status = "denied";
      state.flash = "high-risk send denied";
      renderChrome();
      return;
    }
    const cutover = cutoverFromSeats();
    if (pending.actor === "bot" && !(cutover.status === "attached" && cutover.in_studio_only === true)) {
      state.flash = "BOT_SEND_NO_CUTOVER";
      renderChrome();
      return;
    }
    pending.status = "sent";
    state.flash = "high-risk send approved after HITL";
    renderChrome();
  }

  function showToast(message, kind) {
    if (!els.toast) {
      return;
    }
    els.toast.hidden = !message;
    els.toast.dataset.kind = kind || "info";
    els.toast.textContent = message || "";
  }

  function showSeatError(result) {
    const copy = Studio.seats.errorCopy(result);
    state.flash = copy;
    if (els.cutoverError) {
      els.cutoverError.hidden = false;
      els.cutoverError.textContent = copy;
    }
    showToast(copy, "error");
    renderChrome();
  }

  function clearSeatError() {
    if (els.cutoverError) {
      els.cutoverError.hidden = true;
      els.cutoverError.textContent = "";
    }
  }

  function renderProviderPicker(show) {
    if (!els.seatProviders) {
      return;
    }
    els.seatProviders.hidden = !show;
    els.seatProviders.replaceChildren();
    if (!show) {
      return;
    }
    for (const row of Studio.seats.providerRows()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.provider = row.id;
      button.textContent = row.label;
      if (state.pendingCutover && state.pendingCutover.id === row.id) {
        button.classList.add("on");
      }
      button.addEventListener("click", () => {
        if (!state.pendingCutover) {
          state.pendingCutover = {
            kind: "seat",
            pick: true,
            copy: Studio.seats.CONNECT_ACK,
          };
        }
        state.pendingCutover.kind = "seat";
        state.pendingCutover.pick = true;
        state.pendingCutover.id = row.id;
        state.pendingCutover.title = `Connect ${row.label}`;
        els.cutoverTitle.textContent = state.pendingCutover.title;
        clearSeatError();
        renderProviderPicker(true);
      });
      els.seatProviders.appendChild(button);
    }
  }

  function openAddSeat(provider) {
    const known = provider && Studio.seats.isKnownProvider(provider) ? provider : null;
    const label = known ? Studio.seats.providerLabel(known) : null;
    openCutover({
      kind: "seat",
      id: known,
      pick: true,
      title: label ? `Connect ${label}` : "Add seat",
      copy: Studio.seats.CONNECT_ACK,
    });
  }

  function applySeatConnect(result) {
    const applied = Studio.seats.applyConnectResult(state.seats, result);
    if (!applied.ok) {
      showSeatError(applied);
      return false;
    }
    state.seats = applied.seats;
    state.selectedSeat = applied.seat.id;
    clearSeatError();
    showToast(`${applied.seat.name} online · in-studio-only`, "ok");
    setPresenceOpen(true);
    closeCutover();
    renderChrome();
    return true;
  }

  function seatsRoute(method) {
    switch (method) {
      case "connect":
        return { path: "/seats/connect", verb: "POST" };
      case "list":
        return { path: "/seats/list", verb: "GET" };
      case "presence":
        return { path: "/seats/presence", verb: "GET" };
      case "providers":
        return { path: "/seats/providers", verb: "GET" };
      default:
        return Studio.assertNever(method);
    }
  }

  function seatsPayload(method, value) {
    switch (method) {
      case "connect":
        return { provider: value };
      case "list":
      case "presence":
      case "providers":
        return {};
      default:
        return Studio.assertNever(method);
    }
  }

  async function seatsInvoke(method, value) {
    try {
      if (window.studioShell && window.studioShell.seats && typeof window.studioShell.seats[method] === "function") {
        return await window.studioShell.seats[method](value);
      }
      const route = seatsRoute(method);
      const response = await fetch(route.path, {
        method: route.verb,
        headers: { "Content-Type": "application/json" },
        body: route.verb === "GET" ? undefined : JSON.stringify(seatsPayload(method, value)),
      });
      return await response.json();
    } catch (_err) {
      return {
        ok: false,
        code: "SEATS_UNREACHABLE",
        detail: "Seats API unreachable",
        visible_error: true,
      };
    }
  }

  function onConnector(id) {
    if (id === "add") {
      openAddSeat();
      return;
    }
    if (Studio.seats.isKnownProvider(id)) {
      openAddSeat(id);
      return;
    }
    const connector = state.connectors.find((item) => item.id === id);
    if (!connector) {
      return;
    }
    switch (connector.status) {
      case "live":
      case "error": {
        state.inboxFilter = id;
        const match = (state.inbox || []).find((item) => item.provider === id && item.need_you);
        state.boundTo = match ? match.id : null;
        renderChrome();
        return;
      }
      case "needs_auth":
      case "disconnected":
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
    clearSeatError();
    renderProviderPicker(pending.kind === "seat" && pending.pick === true);
    els.cutoverSheet.hidden = false;
    setPresenceOpen(false);
    els.cutoverConfirm.focus();
  }

  function closeCutover() {
    state.pendingCutover = null;
    renderProviderPicker(false);
    clearSeatError();
    els.cutoverSheet.hidden = true;
  }

  async function confirmCutover() {
    const pending = state.pendingCutover;
    if (!pending) {
      showSeatError({
        ok: false,
        code: "BAD_ARGUMENT",
        detail: "Nothing to connect",
      });
      closeCutover();
      return;
    }
    switch (pending.kind) {
      case "seat": {
        if (!pending.id || !Studio.seats.isKnownProvider(pending.id)) {
          showSeatError({
            ok: false,
            code: "BAD_ARGUMENT",
            detail: "Pick a provider: claude, grok, cursor, codex, gemini, or chatgpt.",
          });
          return;
        }
        els.cutoverConfirm.disabled = true;
        const result = await seatsInvoke("connect", pending.id);
        els.cutoverConfirm.disabled = false;
        if (!result || result.ok !== true) {
          showSeatError(result || { ok: false, code: "NO_OP", detail: "Connect did nothing" });
          return;
        }
        applySeatConnect(result);
        return;
      }
      case "connector": {
        if (pending.id === "add" || Studio.seats.isKnownProvider(pending.id)) {
          openAddSeat(Studio.seats.isKnownProvider(pending.id) ? pending.id : null);
          return;
        }
        const connector = state.connectors.find((item) => item.id === pending.id);
        if (!connector) {
          showSeatError({
            ok: false,
            code: "UNKNOWN_PROVIDER",
            detail: `Unknown connector: ${pending.id}`,
          });
          return;
        }
        connector.status = "live";
        closeCutover();
        renderChrome();
        return;
      }
      default:
        Studio.assertNever(pending.kind);
    }
  }

  function chatRoute(method) {
    switch (method) {
      case "bind":
        return { path: "/chat/bind", verb: "POST" };
      case "state":
        return { path: "/chat/state", verb: "GET" };
      case "send":
        return { path: "/chat/send", verb: "POST" };
      case "refresh":
        return { path: "/chat/refresh", verb: "POST" };
      case "selectRepo":
        return { path: "/chat/bind", verb: "POST" };
      case "setCodeFocus":
        return { path: "/chat/focus", verb: "POST" };
      default:
        return Studio.assertNever(method);
    }
  }

  function chatPayload(method, value) {
    switch (method) {
      case "bind":
      case "selectRepo":
        return value ? { repo: value } : {};
      case "send":
        return { text: value };
      case "setCodeFocus":
        return { open: value === true };
      case "state":
      case "refresh":
        return {};
      default:
        return Studio.assertNever(method);
    }
  }

  function applyEngineResult(result) {
    if (result && result.state) {
      state.engine = result.state;
    } else if (result && result.ok === false) {
      state.engine = {
        ...state.engine,
        ok: false,
        code: result.code || "BAD_ARGUMENT",
        detail: result.detail || "chat engine rejected",
      };
    }
    renderChrome();
    return result;
  }

  async function chatInvoke(method, value) {
    try {
      if (window.studioShell && window.studioShell.chat && typeof window.studioShell.chat[method] === "function") {
        return applyEngineResult(await window.studioShell.chat[method](value));
      }
      const route = chatRoute(method);
      const response = await fetch(route.path, {
        method: route.verb,
        headers: { "Content-Type": "application/json" },
        body: route.verb === "GET" ? undefined : JSON.stringify(chatPayload(method, value)),
      });
      return applyEngineResult(await response.json());
    } catch (_err) {
      return applyEngineResult({ ok: false, code: "BAD_ARGUMENT", detail: "chat engine unreachable" });
    }
  }

  function toggleCode(open) {
    Studio.panes.setCodeOpen(els, state, open);
    Studio.panes.renderBoard(els, state, boardHandlers);
    chatInvoke("setCodeFocus", open);
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
    if (els.ctaGithub) {
      els.ctaGithub.addEventListener("click", () => onConnector("github"));
    }
    if (els.ctaSeat) {
      els.ctaSeat.addEventListener("click", () => {
        openAddSeat();
      });
    }
    els.btnCode.addEventListener("click", () => {
      toggleCode(!state.codeOpen);
    });
    if (els.hintCode) {
      els.hintCode.addEventListener("click", () => {
        toggleCode(true);
      });
    }
    els.btnClose.addEventListener("click", () => {
      toggleCode(false);
    });
    if (els.bindStatus) {
      els.bindStatus.addEventListener("click", () => {
        chatInvoke("selectRepo");
      });
    }
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
        const kind = Studio.panes.replyKindFor(bound);
        if (Studio.panes.needsHitlCard(kind)) {
          state.pendingHitl = {
            id: `hitl:${kind}:${bound.id}`,
            kind,
            title: bound.title || "High-risk outbound",
            destination: bound.provider === "github" ? "GitHub" : "Slack",
            actor: "human",
            payload: text,
            diff: "",
            status: "pending",
          };
          state.flash = "high-risk send needs Board HITL";
          els.composerInput.value = "";
          renderChrome();
          return;
        }
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
      els.composerInput.value = "";
      chatInvoke("send", text).then((result) => {
        if (result && result.ok) {
          state.flash = "sent through chat engine";
        } else {
          state.flash = result && result.code ? result.code : "chat send failed";
        }
        renderChrome();
      });
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
        toggleCode(false);
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

  async function loadSeats() {
    const result = await seatsInvoke("list");
    if (!result || result.ok !== true || !Array.isArray(result.seats)) {
      return;
    }
    for (const seat of result.seats) {
      if (seat.kind !== "bot") {
        continue;
      }
      if (seat.presence !== "online" && seat.in_studio_only !== true) {
        continue;
      }
      const applied = Studio.seats.applyConnectResult(state.seats, { ok: true, seat });
      if (applied.ok) {
        state.seats = applied.seats;
      }
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
    await chatInvoke("bind");
    Studio.panes.setCodeOpen(els, state, false);
    if (initialView() === "live") {
      await loadInbox();
    }
    setView(initialView());
    if (state.view !== "live") {
      await loadSeats();
      renderChrome();
    } else {
      bindFirstInbox();
      renderChrome();
    }
    wireChrome();
  }

  boot();
})();
