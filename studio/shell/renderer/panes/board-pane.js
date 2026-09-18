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
          return { label: "Running", state: "running", detail: "" };
        }
        return { label: "Idle", state: "idle", detail: "" };
      case "proof":
        if (who === "proof") {
          return { label: "Proof", state: "checking", detail: "" };
        }
        if (who === "human") {
          return { label: "Proof", state: "ready", detail: "" };
        }
        return { label: "Proof", state: "idle", detail: "" };
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

  function inboxGates(state) {
    return (state.inbox || []).filter((item) => item.need_you && item.needs_gate && isWakeKind(item));
  }

  function renderInboxGate(els, item, handlers) {
    const gate = document.createElement("div");
    gate.className = "gate row";
    gate.dataset.inbox = item.id;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "Needs you";
    const title = document.createElement("div");
    title.className = "title t";
    title.textContent = item.title;
    const acts = document.createElement("div");
    acts.className = "actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", () => handlers.bindInbox(item.id));
    acts.append(open);
    gate.append(label, title, acts);
    els.boardBody.appendChild(gate);
  }

  function egressRisk(kind) {
    switch (kind) {
      case "merge":
      case "deploy":
      case "db":
      case "public_post":
        return "high";
      case "reply":
      case "comment":
      case "review":
      case "review_comment":
      case "review_request":
      case "ci_failure":
      case "auth_failure":
      case "mention":
      case "dm":
      case "message":
      case "issue_comment":
      case "pull_request_review":
      case "pull_request_review_comment":
        return "low";
      default:
        return assertNever(kind);
    }
  }

  function needsHitlCard(kind) {
    return egressRisk(kind) === "high";
  }

  function hitlKindLabel(kind) {
    switch (kind) {
      case "merge":
        return "Merge";
      case "deploy":
        return "Deploy";
      case "db":
        return "DB";
      case "public_post":
        return "Public post";
      default:
        return assertNever(kind);
    }
  }

  function actorLabel(pending) {
    if (!pending || pending.actor !== "bot") {
      return "You";
    }
    const seat = pending.seat ? ` · ${pending.seat}` : "";
    return `Bot${seat}`;
  }

  function kernelGates(state) {
    return (state.gates || []).filter((gate) => gate && gate.need_you);
  }

  function hitlPending(state) {
    return kernelGates(state).length > 0;
  }

  function renderKernelGate(els, gate, handlers, index) {
    const card = document.createElement("div");
    card.className = "gate row open";
    card.id = index === 0 ? "hitl-pending" : `hitl-${gate.id}`;
    card.dataset.hitlKind = gate.kind;
    card.dataset.gateId = gate.id;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "HITL";
    const title = document.createElement("div");
    title.className = "title t";
    title.textContent = gate.title || (gate.kind === "merge" ? "Merge gate" : hitlKindLabel(gate.kind));
    const dest = document.createElement("div");
    dest.className = "label dest";
    dest.textContent = gate.risk ? `destination · ${gate.risk}` : "destination";
    const actor = document.createElement("div");
    actor.className = "label actor";
    actor.textContent = actorLabel({ actor: "human" });
    const payloadLabel = document.createElement("div");
    payloadLabel.className = "label payload-label";
    payloadLabel.textContent = "Payload";
    const payload = document.createElement("pre");
    payload.className = "payload";
    payload.textContent = gate.payload_summary || "";
    const acts = document.createElement("div");
    acts.className = "actions";
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "ok";
    allow.textContent = "Approve";
    allow.addEventListener("click", () => handlers.resolveHitl("approved", gate.id));
    const deny = document.createElement("button");
    deny.type = "button";
    deny.textContent = "Deny";
    deny.addEventListener("click", () => handlers.resolveHitl("rejected", gate.id));
    const openDiff = document.createElement("button");
    openDiff.type = "button";
    openDiff.textContent = "Diff";
    openDiff.addEventListener("click", () => handlers.openDiff());
    acts.append(allow, deny, openDiff);
    card.append(label, title, dest, actor, payloadLabel, payload, acts);
    els.boardBody.appendChild(card);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();

    const gates = kernelGates(state);
    gates.forEach((gate, index) => {
      renderKernelGate(els, gate, handlers, index);
    });
    if (!gates.length) {
      for (const item of inboxGates(state)) {
        renderInboxGate(els, item, handlers);
      }
    }

    const hasGate = Boolean(els.boardBody.querySelector(".gate"));
    const boardH = document.querySelector(".board-h");
    if (boardH) {
      boardH.hidden = false;
      boardH.textContent = "Needs you";
    }

    const quiet = document.createElement("div");
    quiet.className = "quiet";
    quiet.id = "board-empty";
    if (state.flash) {
      quiet.textContent = state.flash;
    } else if (!hasGate) {
      quiet.textContent = "None";
    } else {
      quiet.textContent = "";
    }
    els.boardBody.appendChild(quiet);

    renderInstruments(els, state);
    renderWatches(els, state);
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.waitingLabel = waitingLabel;
  Studio.panes.instrumentFor = instrumentFor;
  Studio.panes.inboxGates = inboxGates;
  Studio.panes.egressRisk = egressRisk;
  Studio.panes.needsHitlCard = needsHitlCard;
  Studio.panes.hitlKindLabel = hitlKindLabel;
  Studio.panes.actorLabel = actorLabel;
  Studio.panes.kernelGates = kernelGates;
  Studio.panes.hitlPending = hitlPending;
  Studio.panes.renderInstruments = renderInstruments;
  Studio.panes.renderWatches = renderWatches;
  Studio.panes.renderBoard = renderBoard;
})(globalThis.StudioShell = globalThis.StudioShell || {});
