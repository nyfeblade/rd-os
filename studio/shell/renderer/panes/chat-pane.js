"use strict";

(function attachChatPane(Studio) {
  const THREADS = {
    human: [],
    grok: [{ who: "Grok", body: "Connect to chat.", me: false }],
    claude: [{ who: "Claude", body: "Connect to chat.", me: false }],
    cursor: [{ who: "Cursor", body: "Connect to chat.", me: false }],
    "room:chat": [{ who: "Agents", body: "Connect to chat.", me: false }],
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

  function chatDest(item) {
    return item.dest === "chat" || item.dest === "chat+board";
  }

  function isWakeKind(item) {
    switch (item.kind) {
      case "review_request":
      case "review":
      case "review_comment":
      case "ci_failure":
      case "auth_failure":
        return true;
      case "comment":
      case "mention":
      case "dm":
        return false;
      default:
        return false;
    }
  }

  function inboxForChat(state) {
    return (state.inbox || []).filter((item) => {
      if (!item.need_you || !chatDest(item)) {
        return false;
      }
      if (state.inboxFilter && item.provider !== state.inboxFilter) {
        return false;
      }
      if (!state.inboxFilter && !isWakeKind(item)) {
        return false;
      }
      return true;
    });
  }

  function boundItem(state) {
    if (!state.boundTo) {
      return null;
    }
    return (state.inbox || []).find((item) => item.id === state.boundTo) || null;
  }

  function replyKindFor(item) {
    switch (item.provider) {
      case "github":
        switch (item.kind) {
          case "review_comment":
            return "pull_request_review_comment";
          case "review":
          case "review_request":
            return "pull_request_review";
          case "comment":
          case "ci_failure":
          case "auth_failure":
            return "issue_comment";
          default:
            return "issue_comment";
        }
      case "slack":
        switch (item.kind) {
          case "mention":
          case "dm":
          case "auth_failure":
            return "message";
          default:
            return "message";
        }
      default:
        return Studio.assertNever(item.provider);
    }
  }

  function renderSeats(els, _state, _handlers) {
    els.seatList.replaceChildren();
    els.seatList.hidden = true;
    els.seatList.dataset.cutover = "in-studio-only";
    els.seatList.setAttribute("aria-hidden", "true");
  }

  function renderInboxContext(els, state) {
    const bound = boundItem(state);
    if (!els.inboxCtx || !els.composeHint) {
      return;
    }
    if (state.view === "cold" || !bound) {
      els.inboxCtx.hidden = true;
      els.composeHint.hidden = true;
      return;
    }
    els.inboxCtx.hidden = false;
    els.inboxCtx.replaceChildren();
    const who = document.createElement("b");
    who.textContent = bound.provider === "github" ? "GitHub" : "Slack";
    els.inboxCtx.append(who, document.createTextNode(` · ${bound.title}`));
    els.composeHint.hidden = false;
    const slack = (state.connectors || []).find((row) => row.id === "slack");
    const slackAuth = slack && (slack.status === "needs_auth" || slack.status === "error");
    const hitl = Studio.panes.hitlPending && Studio.panes.hitlPending(state);
    if (hitl) {
      els.composeHint.textContent = "HITL pending";
    } else if (slackAuth) {
      els.composeHint.textContent = "Slack · sign in";
    } else {
      els.composeHint.textContent = "Bound";
    }
  }

  function appendMessage(els, message) {
    if (!message || !message.body) {
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "msg";
    if (message.kind) {
      wrap.dataset.kind = message.kind;
    }
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = message.who;
    const body = document.createElement("div");
    body.className = "txt";
    body.textContent = message.body;
    wrap.append(who, body);
    els.messages.appendChild(wrap);
  }


  function isChromeInstruction(message) {
    if (!message) return true;
    if (message.kind === "system" || message.kind === "coding_mode" || message.kind === "context") {
      return true;
    }
    const body = String(message.body || "");
    if (/assume workspace context/i.test(body)) return true;
    if (/do not ask user to paste/i.test(body)) return true;
    if (/coding mode:/i.test(body)) return true;
    return false;
  }

  function engineMessages(state) {
    return state.engine && Array.isArray(state.engine.messages) ? state.engine.messages : [];
  }

  function renderThread(els, state, handlers) {
    const seat = selectedSeat(state);
    const bound = boundItem(state);
    const inbox = inboxForChat(state);
    els.messages.replaceChildren();

    if (state.view === "live" && inbox.length) {
      for (const item of inbox) {
        const wrap = document.createElement("button");
        wrap.type = "button";
        wrap.className = item.id === state.boundTo ? "msg inbound on" : "msg inbound";
        wrap.dataset.inbox = item.id;
        wrap.setAttribute("aria-pressed", String(item.id === state.boundTo));
        const who = document.createElement("div");
        who.className = "who";
        who.textContent = item.provider === "github" ? "GitHub" : "Slack";
        const body = document.createElement("div");
        body.className = "txt";
        body.textContent = item.body || item.title;
        wrap.append(who, body);
        wrap.addEventListener("click", () => {
          if (handlers && typeof handlers.bindInbox === "function") {
            handlers.bindInbox(item.id);
          }
        });
        els.messages.appendChild(wrap);
      }
      for (const message of engineMessages(state)) {
        if (isChromeInstruction(message)) {
          continue;
        }
        appendMessage(els, message);
      }
      if (state.outbox && state.outbox.length) {
        for (const sent of state.outbox) {
          appendMessage(els, {
            who: sent.actor === "bot" ? "Bot" : "You",
            body: sent.body,
            kind: "outbox",
          });
        }
      } else if (bound) {
        /* composer is the draft — no essay bubble */
      }
      els.composerInput.placeholder = bound
        ? `${bound.provider === "github" ? "GitHub" : "Slack"}…`
        : `Message ${seat.name}…`;
      els.composerInput.disabled = false;
      if (els.composeSend) {
        els.composeSend.textContent = "Send";
      }
    } else {
      const live = engineMessages(state);
      if (live.length) {
        for (const message of live) {
          if (isChromeInstruction(message)) {
            continue;
          }
          appendMessage(els, message);
        }
      } else {
        const messages = THREADS[seat.id] || [];
        for (const message of messages) {
          appendMessage(els, message);
        }
      }
      els.composerInput.placeholder = `Message ${seat.name}…`;
      els.composerInput.disabled = false;
      if (els.composeSend) {
        els.composeSend.textContent = "Send";
      }
    }

    renderInboxContext(els, state);
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
  Studio.panes.boundItem = boundItem;
  Studio.panes.replyKindFor = replyKindFor;
  Studio.panes.inboxForChat = inboxForChat;
  Studio.panes.renderSeats = renderSeats;
  Studio.panes.renderThread = renderThread;
  Studio.panes.pushLocal = pushLocal;
})(globalThis.StudioShell = globalThis.StudioShell || {});
