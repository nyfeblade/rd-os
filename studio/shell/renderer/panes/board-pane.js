"use strict";

(function attachBoardPane(Studio) {
  const assertNever = Studio.assertNever;

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

  function instrumentFor(kind, dump) {
    const who = dump && dump.p0 ? dump.p0.waiting_on : null;
    switch (kind) {
      case "ca":
        if (who === "agent") {
          return { label: "Agent map", state: "running", detail: "a coding agent · open gate" };
        }
        return { label: "Agent map", state: "idle", detail: "no run — any provider" };
      case "proof":
        if (who === "proof") {
          return { label: "Proof", state: "checking", detail: "dual-gate in progress" };
        }
        if (who === "human") {
          return { label: "Proof", state: "ready", detail: "checks in — needs you" };
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

  function card(kind, title, meta, extraClass) {
    const el = document.createElement("div");
    el.className = extraClass ? `card ${extraClass}` : "card";
    const k = document.createElement("div");
    k.className = "k";
    k.textContent = kind;
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = title;
    const m = document.createElement("div");
    m.className = "m";
    m.textContent = meta;
    el.append(k, t, m);
    return el;
  }

  function sectionHead(title) {
    const head = document.createElement("div");
    head.className = "board-h";
    head.textContent = title;
    return head;
  }

  function renderInstruments(els, state) {
    els.instruments.replaceChildren();
    els.instruments.appendChild(sectionHead("CA / builders"));
    const item = instrumentFor("ca", state.dump);
    const el = card("Cloud agent", item.label, `${item.state} · ${item.detail}`);
    el.dataset.instrument = "ca";
    els.instruments.appendChild(el);
    if (state.view === "live") {
      els.instruments.appendChild(card("Cloud agent", "shell · idle", "no run — any provider"));
    }
  }

  function renderWatches(els, state) {
    els.watches.replaceChildren();
    els.watches.appendChild(sectionHead("Watches"));
    if (state.view === "live") {
      els.watches.appendChild(card("Linear", "eng board", "live via connector"));
      const sentry = card("Sentry", "errors", "disconnected — connect in tray");
      sentry.style.opacity = "0.65";
      els.watches.appendChild(sentry);
      const vercel = card("Vercel", "deploys", "disconnected");
      vercel.style.opacity = "0.65";
      els.watches.appendChild(vercel);
      return;
    }
    const items = state.dump && state.dump.p0 ? ["nightly proof packet", "merge-gate age"] : [];
    if (!items.length) {
      els.watches.appendChild(card("Watch", "No watches yet", "Connect a provider to enable"));
      return;
    }
    for (const item of items) {
      els.watches.appendChild(card("Watch", item, "live"));
    }
  }

  function renderGateTable(els, state, handlers) {
    const dump = state.dump;
    const humanGate = dump && dump.p0 && dump.p0.waiting_on === "human";
    if (!humanGate) {
      const empty = card("Gates", "Nothing blocked on you", "Connect a provider to see gates");
      empty.id = "board-empty";
      els.boardBody.appendChild(empty);
      return;
    }

    const need = card("Proof gate", "Merge gate", "Needs a human", "need");
    const row = document.createElement("div");
    row.className = "row";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn p";
    approve.textContent = "Approve";
    approve.addEventListener("click", () => handlers.resolveGate("approve"));
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn g";
    reject.textContent = "Reject";
    reject.addEventListener("click", () => handlers.resolveGate("reject"));
    const openDiff = document.createElement("button");
    openDiff.type = "button";
    openDiff.className = "btn g";
    openDiff.textContent = "Open diff";
    openDiff.addEventListener("click", () => handlers.openDiff());
    const age = document.createElement("span");
    age.className = "age";
    age.textContent = formatAge(dump.p0.age_s);
    row.append(approve, reject, openDiff, age);
    need.appendChild(row);
    els.boardBody.appendChild(need);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();

    if (!state.dump) {
      els.boardBody.appendChild(card("Gates", "Can't reach the board stub", "Retry later"));
    } else {
      renderGateTable(els, state, handlers);
    }

    renderInstruments(els, state);
    renderWatches(els, state);

    const dump = state.dump;
    const gates = dump && dump.open_gates && dump.open_gates.length ? dump.open_gates.join(" · ") : "none";
    const cutoverCount = state.seats.filter((seat) => seat.cutover).length;
    const foot = document.createElement("p");
    foot.className = "foot";
    const codeNote = state.codeOpen ? "Code open on demand" : "Code closed by default";
    const flash = state.flash ? ` · ${state.flash}` : "";
    foot.textContent = `Open gates: ${gates} · in-studio-only on ${cutoverCount} seats · ${codeNote}${flash}`;
    els.boardBody.appendChild(foot);
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.waitingLabel = waitingLabel;
  Studio.panes.instrumentFor = instrumentFor;
  Studio.panes.renderInstruments = renderInstruments;
  Studio.panes.renderWatches = renderWatches;
  Studio.panes.renderBoard = renderBoard;
})(globalThis.StudioShell = globalThis.StudioShell || {});
