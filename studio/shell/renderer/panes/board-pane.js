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

  function sectionHead(title) {
    const head = document.createElement("div");
    head.className = "sec";
    head.textContent = title;
    return head;
  }

  function renderInstruments(els, state) {
    els.instruments.replaceChildren();
    els.instruments.appendChild(sectionHead("CA map"));
    const item = instrumentFor("ca", state.dump);
    const card = document.createElement("div");
    card.className = "ca-card";
    card.dataset.instrument = "ca";
    const title = document.createElement("b");
    title.textContent = item.label;
    card.append(title, document.createTextNode(` · ${item.state} · ${item.detail}`));
    els.instruments.appendChild(card);
  }

  function renderWatches(els, state) {
    els.watches.replaceChildren();
    els.watches.appendChild(sectionHead("Watches"));
    const items = state.dump && state.dump.p0 ? ["nightly proof packet", "merge-gate age"] : [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "ca-card";
      empty.textContent = "No watches yet. Add a check after you connect a provider.";
      els.watches.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "ca-card";
      row.textContent = item;
      els.watches.appendChild(row);
    }
  }

  function renderGateTable(els, state, handlers) {
    const dump = state.dump;
    const humanGate = dump && dump.p0 && dump.p0.waiting_on === "human";
    if (!humanGate) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.id = "board-empty";
      empty.textContent = "Nothing blocked on you. Connect a provider to see gates.";
      els.boardBody.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>What</th><th>On</th><th>Age</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    const tr = document.createElement("tr");
    tr.className = "need";
    const what = document.createElement("td");
    const title = document.createElement("div");
    title.className = "what";
    title.textContent = "Merge gate";
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = "Needs a human";
    const acts = document.createElement("div");
    acts.className = "acts";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "go";
    approve.textContent = "Approve";
    approve.addEventListener("click", () => handlers.resolveGate("approve"));
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "no";
    reject.textContent = "Reject";
    reject.addEventListener("click", () => handlers.resolveGate("reject"));
    const openDiff = document.createElement("button");
    openDiff.type = "button";
    openDiff.className = "no";
    openDiff.textContent = "Open diff";
    openDiff.addEventListener("click", () => handlers.openDiff());
    acts.append(approve, reject, openDiff);
    what.append(title, sub, acts);
    const on = document.createElement("td");
    on.textContent = waitingLabel("human");
    const age = document.createElement("td");
    age.textContent = formatAge(dump.p0.age_s);
    tr.append(what, on, age);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    els.boardBody.appendChild(table);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();
    els.boardBody.appendChild(sectionHead("Gates"));

    if (!state.dump) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.textContent = "Can't reach the board stub.";
      els.boardBody.appendChild(empty);
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
