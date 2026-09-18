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

  function hideUntilNeeded(el) {
    el.replaceChildren();
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  }

  function renderInstruments(els, _state) {
    hideUntilNeeded(els.instruments);
  }

  function renderWatches(els, _state) {
    hideUntilNeeded(els.watches);
  }

  function renderHumanGate(els, state, handlers) {
    const dump = state.dump;
    const humanGate = dump && dump.p0 && dump.p0.waiting_on === "human";

    if (humanGate) {
      const gate = document.createElement("div");
      gate.className = "gate";
      gate.id = "human-gate";
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = "Needs you";
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = dump.p0.why || "Merge gate";
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
      openDiff.textContent = "View diff";
      openDiff.addEventListener("click", () => handlers.openDiff());
      acts.append(approve, reject, openDiff);
      gate.append(label, title, acts);
      els.boardBody.appendChild(gate);
    }

    const quiet = document.createElement("div");
    quiet.className = "quiet";
    quiet.id = "board-empty";
    if (state.view === "cold") {
      quiet.textContent = "";
    } else if (humanGate) {
      quiet.textContent = "Nothing else needs you.";
    } else {
      quiet.textContent = "Nothing else needs you.";
    }
    if (state.flash) {
      quiet.textContent = state.flash;
    }
    els.boardBody.appendChild(quiet);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();

    if (!state.dump) {
      const fail = document.createElement("p");
      fail.className = "quiet";
      fail.textContent = "Can't reach the board stub";
      els.boardBody.appendChild(fail);
    } else {
      renderHumanGate(els, state, handlers);
    }

    renderInstruments(els, state);
    renderWatches(els, state);
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.waitingLabel = waitingLabel;
  Studio.panes.instrumentFor = instrumentFor;
  Studio.panes.renderInstruments = renderInstruments;
  Studio.panes.renderWatches = renderWatches;
  Studio.panes.renderBoard = renderBoard;
})(globalThis.StudioShell = globalThis.StudioShell || {});
