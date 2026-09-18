"use strict";

/**
 * Quiet-default: no wake/ping chrome on FYI/ack.
 * Only PR / Proof / FAIL / fence / HITL may ping.
 */

function assertNever(value) {
  throw new Error(`unhandled variant: ${value}`);
}

function wakeClass(item) {
  if (!item || item.need_you === false) {
    return null;
  }
  switch (item.kind) {
    case "review_request":
    case "review":
    case "review_comment":
      return "PR";
    case "ci_failure":
      return "FAIL";
    case "auth_failure":
      return "fence";
    case "comment":
    case "mention":
    case "dm":
      return null;
    default:
      if (item.kind == null) {
        return assertNever(item.kind);
      }
      return null;
  }
}

function shouldWakeChrome(item) {
  return wakeClass(item) !== null;
}

function shouldTrayPing(item) {
  return shouldWakeChrome(item);
}

module.exports = {
  shouldTrayPing,
  shouldWakeChrome,
  wakeClass,
};
