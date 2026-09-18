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
    els.inboxCtx.appendChild(document.createTextNode("Replying on "));
    const who = document.createElement("b");
    who.textContent = bound.provider === "github" ? "GitHub" : "Slack";
    els.inboxCtx.append(who, document.createTextNode(` · ${bound.title}`));
    els.composeHint.hidden = false;
    const slack = (state.connectors || []).find((row) => row.id === "slack");
    const slackAuth = slack && (slack.status === "needs_auth" || slack.status === "error");
    const hitl = Studio.panes.hitlPending && Studio.panes.hitlPending(state);
    if (hitl) {
      els.composeHint.textContent = "Low-risk reply on this thread · HITL pending on Board";
    } else if (slackAuth) {
      els.composeHint.textContent = "Outbound bound to this notification · Slack needs sign-in in tray";
    } else {
      els.composeHint.textContent = "Outbound bound to this notification";
    }
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
        who.textContent = `${item.provider === "github" ? "GitHub" : "Slack"} → inbox`;
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
      if (state.outbox && state.outbox.length) {
        for (const sent of state.outbox) {
          const wrap = document.createElement("div");
          wrap.className = "msg";
          const who = document.createElement("div");
          who.className = "who";
          who.textContent = sent.actor === "bot" ? "Bot (gated)" : "You (from Studio)";
          const body = document.createElement("div");
          body.className = "txt";
          body.textContent = sent.body;
          wrap.append(who, body);
          els.messages.appendChild(wrap);
        }
      } else if (bound) {
        const wrap = document.createElement("div");
        wrap.className = "msg";
        const who = document.createElement("div");
        who.className = "who";
        who.textContent = "You (draft out)";
        const body = document.createElement("div");
        body.className = "txt draft";
        body.textContent = `Composer below sends the reply to ${
          bound.provider === "github" ? "GitHub" : "Slack"
        } on this thread.`;
        wrap.append(who, body);
        els.messages.appendChild(wrap);
      }
      els.composerInput.placeholder = bound
        ? `Reply on ${bound.provider === "github" ? "GitHub" : "Slack"}…`
        : "Select an inbox thread to reply…";
      els.composerInput.disabled = !bound;
      if (els.composeSend) {
        els.composeSend.textContent = bound
          ? `Send to ${bound.provider === "github" ? "GitHub" : "Slack"}`
          : "Send";
      }
    } else {
      const messages = THREADS[seat.id] || [];
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
