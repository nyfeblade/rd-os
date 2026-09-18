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

  function hitlPending(state) {
    const pending = state.pendingHitl;
    return Boolean(pending && pending.status !== "sent" && pending.status !== "denied");
  }

  function renderHitlCard(els, state, handlers) {
    const pending = state.pendingHitl;
    if (!hitlPending(state)) {
      return;
    }
    const gate = document.createElement("div");
    gate.className = "gate row open";
    gate.id = "hitl-pending";
    gate.dataset.hitlKind = pending.kind;
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "HITL";
    const title = document.createElement("div");
    title.className = "title t";
    title.textContent = pending.title || hitlKindLabel(pending.kind);
    const dest = document.createElement("div");
    dest.className = "label dest";
    dest.textContent = pending.destination || "";
    const actor = document.createElement("div");
    actor.className = "label actor";
    actor.textContent = actorLabel(pending);
    const payloadLabel = document.createElement("div");
    payloadLabel.className = "label payload-label";
    payloadLabel.textContent = "Payload";
    const payload = document.createElement("pre");
    payload.className = "payload";
    payload.textContent = pending.payload || "";
    const diffLabel = document.createElement("div");
    diffLabel.className = "label";
    diffLabel.textContent = "Diff";
    const diff = document.createElement("pre");
    diff.className = "diff";
    diff.textContent = pending.diff || "";
    const acts = document.createElement("div");
    acts.className = "actions";
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "ok";
    allow.textContent = "Approve";
    allow.addEventListener("click", () => handlers.resolveHitl("approved"));
    const deny = document.createElement("button");
    deny.type = "button";
    deny.textContent = "Deny";
    deny.addEventListener("click", () => handlers.resolveHitl("rejected"));
    acts.append(allow, deny);
    gate.append(label, title, dest, actor, payloadLabel, payload, diffLabel, diff, acts);
    els.boardBody.appendChild(gate);
  }

  function renderDumpGate(els, state, handlers) {
    const dump = state.dump;
    const humanGate = dump && dump.p0 && dump.p0.waiting_on === "human";
    if (!humanGate || inboxGates(state).length) {
      return;
    }
    const gate = document.createElement("div");
    gate.className = "gate row";
    gate.id = "human-gate";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "Needs you";
    const title = document.createElement("div");
    title.className = "title t";
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
    openDiff.textContent = "Diff";
    openDiff.addEventListener("click", () => handlers.openDiff());
    acts.append(approve, reject, openDiff);
    gate.append(label, title, acts);
    els.boardBody.appendChild(gate);
  }

  function renderBoard(els, state, handlers) {
    els.boardBody.replaceChildren();

    if (state.view !== "cold") {
      if (hitlPending(state)) {
        renderHitlCard(els, state, handlers);
      } else {
        for (const item of inboxGates(state)) {
          renderInboxGate(els, item, handlers);
        }
      }
    }

    if (state.dump) {
      renderDumpGate(els, state, handlers);
    } else if (state.view !== "cold" && !inboxGates(state).length && !hitlPending(state)) {
      const fail = document.createElement("p");
      fail.className = "quiet";
      fail.textContent = "Unreachable";
      els.boardBody.appendChild(fail);
    }

    const quiet = document.createElement("div");
    quiet.className = "quiet";
    quiet.id = "board-empty";
    if (state.view === "cold") {
      quiet.textContent = "";
    } else if (state.flash) {
      quiet.textContent = state.flash;
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
  Studio.panes.hitlPending = hitlPending;
  Studio.panes.renderInstruments = renderInstruments;
  Studio.panes.renderWatches = renderWatches;
  Studio.panes.renderBoard = renderBoard;
})(globalThis.StudioShell = globalThis.StudioShell || {});
