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

  function boardRows(dump) {
    const rows = [];
    if (dump && dump.p0 && dump.p0.waiting_on === "human") {
      rows.push({
        id: dump.p0.id,
        what: "Merge gate",
        sub: "Needs a human",
        waitingOn: "human",
        ageS: dump.p0.age_s,
      });
    }
    const ca = instrumentFor("ca", dump);
    const proof = instrumentFor("proof", dump);
    rows.push({
      id: "ca",
      what: "Agent map",
      sub: ca.detail,
      waitingOn: "agent",
      ageS: dump && dump.p0 && dump.p0.waiting_on === "agent" ? dump.p0.age_s : 0,
    });
    rows.push({
      id: "proof",
      what: "Proof",
      sub: proof.detail,
      waitingOn: "proof",
      ageS: dump && dump.p0 && dump.p0.waiting_on === "proof" ? dump.p0.age_s : 240,
    });
    return rows;
  }

  function renderInstruments(els, state) {
    els.instruments.replaceChildren();
    for (const kind of ["ca", "proof"]) {
      const item = instrumentFor(kind, state.dump);
      const card = document.createElement("div");
      card.className = "instrument";
      card.dataset.instrument = kind;
      const k = document.createElement("div");
      k.className = "k";
      k.textContent = item.label;
      const v = document.createElement("div");
      v.className = "v";
      v.textContent = item.state;
      const d = document.createElement("div");
      d.className = "d";
      d.textContent = item.detail;
      card.append(k, v, d);
      els.instruments.appendChild(card);
    }
  }

  function renderWatches(els, state) {
    els.watches.replaceChildren();
    const head = document.createElement("div");
    head.className = "k";
    head.textContent = "Watches";
    els.watches.appendChild(head);
    const items = state.dump && state.dump.p0 ? ["nightly proof packet", "merge-gate age"] : [];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "watch";
      empty.textContent = "No watches yet. Add a check after you connect a provider.";
      els.watches.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "watch";
      row.textContent = item;
      els.watches.appendChild(row);
    }
  }

  function renderBoard(els, state, handlers) {
    renderInstruments(els, state);
    els.boardBody.replaceChildren();

    if (!state.dump) {
      const empty = document.createElement("p");
      empty.className = "foot";
      empty.textContent = "Can't reach the board stub.";
      els.boardBody.appendChild(empty);
      return;
    }

    if (!state.dump.p0) {
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
    for (const row of boardRows(state.dump)) {
      const tr = document.createElement("tr");
      if (row.waitingOn === "human") {
        tr.className = "need";
      }
      const what = document.createElement("td");
      if (row.waitingOn !== "human") {
        what.className = "mute";
      }
      const title = document.createElement("div");
      title.className = "what";
      title.textContent = row.what;
      what.appendChild(title);
      if (row.sub) {
        const sub = document.createElement("div");
        sub.className = "sub";
        sub.textContent = row.sub;
        what.appendChild(sub);
      }
      if (row.waitingOn === "human") {
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
        acts.append(approve, reject);
        what.appendChild(acts);
      }
      const on = document.createElement("td");
      on.className = row.waitingOn === "human" ? "" : "mute";
      on.textContent = waitingLabel(row.waitingOn);
      const age = document.createElement("td");
      age.className = row.waitingOn === "human" ? "" : "mute";
      age.textContent = row.ageS > 0 ? formatAge(row.ageS) : "—";
      tr.append(what, on, age);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.boardBody.appendChild(table);

    const dump = state.dump;
    const gates = dump.open_gates && dump.open_gates.length ? dump.open_gates.join(" · ") : "none";
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
