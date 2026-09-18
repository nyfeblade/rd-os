"use strict";

/**
 * Shell HITL classifier. High-risk egress needs a Board pending card.
 * Low-risk bound replies skip the card. Does not implement connector runtime.
 */

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

const HIGH_RISK = ["merge", "deploy", "db", "public_post"];

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

function actorLabel(pending) {
  if (!pending || pending.actor !== "bot") {
    return "human";
  }
  const seat = pending.seat ? ` · ${pending.seat}` : "";
  return `bot${seat} · in-studio-only`;
}

module.exports = {
  HIGH_RISK,
  actorLabel,
  egressRisk,
  needsHitlCard,
};
