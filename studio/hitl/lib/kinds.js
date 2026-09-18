"use strict";

const { assertNever } = require("./codes");

const KIND_RISK = {
  merge: "high",
  deploy: "high",
  db: "high",
  public_post: "high",
};

const GATE_KINDS = Object.keys(KIND_RISK);

const HIGH_RISK_KINDS = GATE_KINDS.filter((kind) => KIND_RISK[kind] === "high");

const GATE_STATUSES = ["open", "approved", "rejected", "deferred"];

const DECISIONS = ["approve", "reject", "defer"];

const HUMAN_ACTOR = "human";

const FORBIDDEN_DECISION_ACTORS = [
  "merge",
  "deploy",
  "db",
  "public",
  "public_post",
  "system",
  "auto",
  "bot",
];

function isGateKind(kind) {
  return GATE_KINDS.includes(kind);
}

function isHighRiskKind(kind) {
  return HIGH_RISK_KINDS.includes(kind);
}

function riskOf(kind) {
  return Object.prototype.hasOwnProperty.call(KIND_RISK, kind) ? KIND_RISK[kind] : null;
}

function needYouOf(status) {
  switch (status) {
    case "open":
      return true;
    case "approved":
    case "rejected":
    case "deferred":
      return false;
    default:
      return assertNever(status);
  }
}

function statusFromDecision(decision) {
  switch (decision) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
    default:
      return assertNever(decision);
  }
}

function isDecision(value) {
  return DECISIONS.includes(value);
}

function isForbiddenDecisionActor(actor) {
  return FORBIDDEN_DECISION_ACTORS.includes(actor);
}

module.exports = {
  KIND_RISK,
  GATE_KINDS,
  HIGH_RISK_KINDS,
  GATE_STATUSES,
  DECISIONS,
  HUMAN_ACTOR,
  FORBIDDEN_DECISION_ACTORS,
  isGateKind,
  isHighRiskKind,
  riskOf,
  needYouOf,
  statusFromDecision,
  isDecision,
  isForbiddenDecisionActor,
};
