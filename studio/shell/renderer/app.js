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
    ctaImport: document.getElementById("cta-import"),
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
    gates: [],
    selectedSeat: "human",
    selectedFile: "shell",
    flash: null,
    pendingCutover: null,
    presenceOpen: false,
    codeOpen: false,
    mode: "eng",
    tokens: { session: null, board: null, mission: null, seats: {} },
    githubSession: null,
    lastAuthError: null,
    market: { entries: [] },
    modes: { list: [], active: null },
    mcp: { tools: [], providers: [] },
    modules: null,
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

  function engineBound() {
    return Boolean(state.engine && state.engine.ok && state.engine.thread);
  }

  function githubConnected() {
    return Boolean(state.githubSession && state.githubSession.user);
  }

  function botAttached() {
    return (state.seats || []).some((seat) => seat.kind === "bot" && seat.cutover === true);
  }

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
      const id = seat && seat.id ? seat.id : null;
      if (!id || id === "import-team") {
        importTeam();
        return;
      }
      connectSeatClick(id, seat.name);
    },
    importTeam,
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
    if (bound) {
      els.withEl.textContent = bound.provider === "github" ? "GitHub" : "Slack";
      return;
    }
    const seat = Studio.panes.selectedSeat(state);
    els.withEl.textContent = seat && botAttached() ? seat.name : "";
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

  function renderColdCtas() {
    const showGithub = !githubConnected();
    const showTeam = !botAttached();
    if (els.ctaGithub) {
      els.ctaGithub.hidden = !showGithub;
    }
    if (els.ctaImport) {
      els.ctaImport.hidden = !showTeam;
    }
    if (els.ctaSeat) {
      els.ctaSeat.hidden = true;
    }
    if (els.chatCold) {
      els.chatCold.hidden = !showGithub && !showTeam;
    }
    if (els.chatLive) {
      els.chatLive.hidden = false;
    }
    if (els.chatOnboard) {
      els.chatOnboard.hidden = engineBound();
    }
  }

  function renderChrome() {
    renderWith();
    renderBind();
    renderColdCtas();
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
    const next = rows.map((row) => ({ ...row, status: row.status || "needs_auth" }));
    if (!next.some((row) => row.id === "slack")) {
      next.push({ id: "slack", label: "Slack", status: "needs_auth" });
    }
    if (!next.some((row) => row.id === "github")) {
      next.push({ id: "github", label: "GitHub", status: "needs_auth" });
    }
    return next.map((row) => {
      if (row.id === "github") {
        return { ...row, status: githubConnected() ? "live" : "needs_auth" };
      }
      if (row.status === "live") {
        return { ...row, status: "needs_auth" };
      }
      return row;
    });
  }

  function connectorStatus(id) {
    const row = state.connectors.find((item) => item.id === id);
    return row ? row.status : "needs_auth";
  }

  function cutoverFromSeats() {
    const attached = botAttached();
    return { status: attached ? "attached" : "unattached", in_studio_only: attached };
  }

  function applyLiveState(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.modules = snapshot.modules || state.modules;
    if (snapshot.auth) {
      state.githubSession = snapshot.auth.session || null;
      state.lastAuthError = snapshot.auth.message || snapshot.lastAuthError || null;
    }
    if (Array.isArray(snapshot.seats) && snapshot.seats.length) {
      state.seats = snapshot.seats;
      if (botAttached() && state.selectedSeat === "human") {
        const bot = state.seats.find((seat) => seat.kind === "bot" && seat.cutover === true);
        if (bot) {
          state.selectedSeat = bot.id;
        }
      }
    }
    if (Array.isArray(snapshot.gates)) {
      state.gates = snapshot.gates;
    }
    if (Array.isArray(snapshot.inbox)) {
      state.inbox = snapshot.inbox;
    }
    if (Array.isArray(snapshot.connectors) && snapshot.connectors.length) {
      state.connectors = ensureWire(snapshot.connectors);
    } else {
      state.connectors = ensureWire(state.catalogRows);
    }
    if (snapshot.market) {
      state.market = snapshot.market;
    }
    if (snapshot.modes) {
      state.modes = snapshot.modes;
    }
    if (snapshot.mcp) {
      state.mcp = snapshot.mcp;
    }
    if (snapshot.lastAuthError && snapshot.lastAuthError.message) {
      state.lastAuthError = snapshot.lastAuthError.message;
    }
  }

  async function resolveGate(action) {
    switch (action) {
      case "approve":
      case "reject":
        break;
      default:
        Studio.assertNever(action);
    }
    const open = (state.gates || []).find((gate) => gate.need_you);
    if (!open) {
      state.flash = "no open gate";
      Studio.panes.renderBoard(els, state, boardHandlers);
      return;
    }
    await resolveHitl(action === "approve" ? "approved" : "rejected", open.id);
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

  async function resolveHitl(status, gateId) {
    switch (status) {
      case "approved":
      case "rejected":
        break;
      default:
        Studio.assertNever(status);
    }
    const id = gateId || ((state.gates || []).find((gate) => gate.need_you) || {}).id;
    if (!id) {
      state.flash = "no HITL gate";
      renderChrome();
      return;
    }
    const decision = status === "approved" ? "approve" : "reject";
    const result = await liveInvoke("hitl.resolve", { id, decision, actor: "human" });
    if (result && result.state) {
      applyLiveState(result.state);
    }
    if (result && result.ok) {
      state.flash = decision === "approve" ? "approved" : "rejected";
    } else {
      state.flash = result && result.code ? `CODE: ${result.code}` : "HITL_RESOLVE_FAILED";
    }
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
    const copy = result && result.code
      ? (result.detail ? `CODE: ${result.code} — ${result.detail}` : `CODE: ${result.code}`)
      : Studio.seats.errorCopy(result);
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
    const resolved = provider && Studio.seats.isKnownProvider(provider) ? provider : null;
    const label = resolved ? Studio.seats.providerLabel(resolved) : null;
    openCutover({
      kind: "seat",
      id: resolved,
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
      case "import":
        return { path: "/seats/import", verb: "POST" };
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
      case "import":
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

  async function connectSeatClick(id, name) {
    els.cutoverConfirm && (els.cutoverConfirm.disabled = true);
    const result = await seatsInvoke("connect", id);
    if (els.cutoverConfirm) {
      els.cutoverConfirm.disabled = false;
    }
    if (result && result.state) {
      applyLiveState(result.state);
    }
    if (!result || result.ok !== true) {
      showSeatError(result || { ok: false, code: "NO_OP", detail: "Connect did nothing" });
      return false;
    }
    if (result.seat) {
      applySeatConnect(result);
    } else {
      showToast(`${name || id} attached · studio/mcp`, "ok");
      closeCutover();
      renderChrome();
    }
    const live = await liveInvoke("state");
    if (live && live.ok) {
      applyLiveState(live);
      renderChrome();
    }
    return true;
  }

  async function importTeam() {
    const result = await seatsInvoke("import");
    if (result && result.state) {
      applyLiveState(result.state);
    }
    if (!result || result.ok !== true) {
      showSeatError(result || { ok: false, code: "NO_OP", detail: "Import team did nothing" });
      return;
    }
    showToast("Team imported · Connect a seat", "ok");
    const live = await liveInvoke("state");
    if (live && live.ok) {
      applyLiveState(live);
    }
    renderChrome();
  }

  function onConnector(id) {
    if (id === "add") {
      openAddSeat();
      return;
    }
    if (Studio.seats.isKnownProvider(id)) {
      connectSeatClick(id);
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
        if (id === "github") {
          startGithubAuth();
          return;
        }
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
      return;
    }
    switch (pending.kind) {
      case "seat": {
        if (!pending.id) {
          showSeatError({
            ok: false,
            code: "BAD_ARGUMENT",
            detail: "Pick a provider: claude, grok, cursor, codex, gemini, or chatgpt.",
          });
          return;
        }
        await connectSeatClick(pending.id, pending.title);
        return;
      }
      case "connector": {
        if (pending.id === "github") {
          const started = await startGithubAuth();
          if (started && started.ok) {
            closeCutover();
          }
          return;
        }
        if (pending.id === "add" || Studio.seats.isKnownProvider(pending.id)) {
          openAddSeat(Studio.seats.isKnownProvider(pending.id) ? pending.id : null);
          return;
        }
        showSeatError({
          ok: false,
          code: "NOT_WIRED",
          detail: `${pending.id} is listed; GitHub is the wired OAuth path`,
        });
        return;
      }
      default:
        Studio.assertNever(pending.kind);
    }
  }

  async function startGithubAuth() {
    const result = await liveInvoke("auth.start");
    if (result && result.live) {
      applyLiveState(result.live);
    } else if (result && result.state) {
      applyLiveState(result.state);
    }
    if (result && result.ok) {
      state.flash = result.opened ? "GitHub sign-in opened" : "GitHub OAuth started";
      if (result.url && !window.studioShell) {
        window.open(result.url, "_blank", "noopener");
      }
      renderChrome();
      return result;
    }
    const code = result && result.code ? result.code : "AUTH_FAILED";
    const message = result && result.message ? result.message : result && result.detail ? result.detail : "auth failed";
    showSeatError({ ok: false, code, detail: message });
    const github = state.connectors.find((item) => item.id === "github");
    if (github) {
      github.status = "needs_auth";
    }
    renderChrome();
    return result;
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

  function liveRoute(method, value) {
    switch (method) {
      case "state":
        return { path: "/live/state", verb: "GET" };
      case "auth.start":
        return { path: "/auth/start", verb: "POST", body: {} };
      case "auth.session":
        return { path: "/auth/session", verb: "GET" };
      case "seats.connect":
        return { path: "/seats/connect", verb: "POST", body: { provider: value } };
      case "hitl.create":
        return { path: "/hitl/create", verb: "POST", body: value };
      case "hitl.needYou":
        return { path: "/hitl/need-you", verb: "GET" };
      case "hitl.resolve":
        return { path: "/hitl/resolve", verb: "POST", body: value };
      case "market.browse":
        return { path: "/market/browse", verb: "GET" };
      default:
        return Studio.assertNever(method);
    }
  }

  async function liveInvoke(method, value) {
    try {
      if (window.studioShell) {
        switch (method) {
          case "state":
            return await window.studioShell.live.state();
          case "auth.start":
            return await window.studioShell.auth.start();
          case "auth.session":
            return await window.studioShell.auth.session();
          case "seats.connect":
            return await window.studioShell.seats.connect(value);
          case "hitl.create":
            return await window.studioShell.hitl.create(value);
          case "hitl.needYou":
            return await window.studioShell.hitl.needYou();
          case "hitl.resolve":
            return await window.studioShell.hitl.resolve(value);
          case "market.browse":
            return await window.studioShell.market.browse(value);
          default:
            return Studio.assertNever(method);
        }
      }
      const route = liveRoute(method, value);
      const response = await fetch(route.path, {
        method: route.verb,
        headers: { "Content-Type": "application/json" },
        body: route.verb === "GET" ? undefined : JSON.stringify(route.body || {}),
      });
      return await response.json();
    } catch (_err) {
      return { ok: false, code: "BAD_ARGUMENT", detail: "studio live unreachable" };
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
      els.ctaGithub.addEventListener("click", () => {
        startGithubAuth();
      });
    }
    if (els.ctaSeat) {
      els.ctaSeat.addEventListener("click", () => {
        openAddSeat();
      });
    }
    if (els.ctaImport) {
      els.ctaImport.addEventListener("click", () => {
        importTeam();
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
          liveInvoke("hitl.create", {
            kind,
            title: bound.title || "High-risk outbound",
            payload_summary: text,
          }).then((result) => {
            if (result && result.state) {
              applyLiveState(result.state);
            }
            state.flash = result && result.ok ? "high-risk send needs Board HITL" : result && result.code ? `CODE: ${result.code}` : "HITL create failed";
            els.composerInput.value = "";
            renderChrome();
          });
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
            state.flash = result && result.code ? `CODE: ${result.code}` : "reply failed";
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
          state.flash = result && result.code ? `CODE: ${result.code}` : "chat send failed";
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
    const live = await liveInvoke("state");
    if (live && live.ok) {
      applyLiveState(live);
    }
    await chatInvoke("bind");
    Studio.panes.setCodeOpen(els, state, false);
    renderChrome();
    wireChrome();
  }

  boot();
})();
