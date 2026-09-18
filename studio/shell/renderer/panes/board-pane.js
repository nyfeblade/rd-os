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
    head.className = "section";
    head.textContent = title;
    return head;
  }

  function rowline(title, meta) {
    const el = document.createElement("div");
    el.className = "rowline";
    const name = document.createElement("b");
    name.textContent = title;
    el.appendChild(name);
    if (meta) {
      el.appendChild(document.createTextNode(" · "));
      const span = document.createElement("span");
      span.textContent = meta;
      el.appendChild(span);
    }
    return el;
  }

  function mutedCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    td.style.color = "#666";
    return td;
  }

  function renderInstruments(els, state) {
    els.instruments.replaceChildren();
    els.instruments.appendChild(sectionHead("Agents"));
    if (state.view === "live") {
      const running = rowline("bc-7c385702", "design · running");
      running.dataset.instrument = "ca";
      els.instruments.appendChild(running);
      els.instruments.appendChild(rowline("bc-d0f3", "shell · idle"));
      return;
    }
    const item = instrumentFor("ca", state.dump);
    const el = rowline(item.label, `${item.state} · ${item.detail}`);
    el.dataset.instrument = "ca";
    els.instruments.appendChild(el);
  }

  function renderWatches(els, state) {
    els.watches.replaceChildren();
    els.watches.appendChild(sectionHead("Watches"));
    if (state.view === "live") {
      els.watches.appendChild(rowline("Linear eng board", "live"));
      els.watches.appendChild(rowline("Sentry", "off"));
      els.watches.appendChild(rowline("Vercel", "off"));
      return;
    }
    const items = state.dump && state.dump.p0 ? ["nightly proof packet", "merge-gate age"] : [];
    if (!items.length) {
      els.watches.appendChild(rowline("No watches yet", "Connect a provider to enable"));
      return;
    }
    for (const item of items) {
      els.watches.appendChild(rowline(item, "live"));
    }
  }

  function renderGateTable(els, state, handlers) {
    const dump = state.dump;
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["What", "On", "Age"]) {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    const tbody = document.createElement("tbody");
    const humanGate = dump && dump.p0 && dump.p0.waiting_on === "human";

    if (humanGate) {
      const need = document.createElement("tr");
      need.className = "need";
      const what = document.createElement("td");
      what.appendChild(document.createTextNode(dump.p0.why || "Merge gate"));
      const acts = document.createElement("div");
      acts.className = "actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "ok";
      approve.textContent = "Approve";
      approve.addEventListener("click", () => handlers.resolveGate("approve"));
      const reject = document.createElement("button");
      reject.type = "button";
      reject.textContent = "Reject";
      reject.addEventListener("click", () => handlers.resolveGate("reject"));
      const openDiff = document.createElement("button");
      openDiff.type = "button";
      openDiff.textContent = "Diff";
      openDiff.addEventListener("click", () => handlers.openDiff());
      acts.append(approve, reject, openDiff);
      what.appendChild(acts);
      const on = document.createElement("td");
      on.textContent = waitingLabel(dump.p0.waiting_on);
      const age = document.createElement("td");
      age.textContent = formatAge(dump.p0.age_s);
      need.append(what, on, age);
      tbody.appendChild(need);
    } else {
      const empty = document.createElement("tr");
      empty.id = "board-empty";
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.style.color = "#666";
      cell.textContent = "Nothing blocked on you";
      empty.appendChild(cell);
      tbody.appendChild(empty);
    }

    if (state.view === "live") {
      const ci = document.createElement("tr");
      ci.append(mutedCell("CI · shell"), mutedCell("Proof"), mutedCell("4m"));
      tbody.appendChild(ci);
    }

    table.append(thead, tbody);
    els.boardBody.appendChild(table);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();

    if (!state.dump) {
      const fail = document.createElement("p");
      fail.className = "foot";
      fail.textContent = "Can't reach the board stub";
      els.boardBody.appendChild(fail);
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
    els.watches.appendChild(foot);
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.waitingLabel = waitingLabel;
  Studio.panes.instrumentFor = instrumentFor;
  Studio.panes.renderInstruments = renderInstruments;
  Studio.panes.renderWatches = renderWatches;
  Studio.panes.renderBoard = renderBoard;
})(globalThis.StudioShell = globalThis.StudioShell || {});
