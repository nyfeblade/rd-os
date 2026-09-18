"use strict";

const { assertNeverCommand } = require("./codes");

function emptyInstall() {
  return {
    state: "available",
    error: null,
    installed_at: null,
    updated_at: null,
  };
}

function transition(current, command, opts) {
  const authRequired = Boolean(opts && opts.authRequired);
  const fail = opts && typeof opts.error === "string" && opts.error.length > 0 ? opts.error : null;
  const now = opts && opts.now ? opts.now : null;

  if (command === "revoke") {
    return {
      state: "available",
      error: null,
      installed_at: null,
      updated_at: now,
    };
  }

  if (command === "connect") {
    if (fail) {
      return {
        state: "error",
        error: fail,
        installed_at: current.installed_at || now,
        updated_at: now,
      };
    }
    return {
      state: "live",
      error: null,
      installed_at: current.installed_at || now,
      updated_at: now,
    };
  }

  if (command === "install") {
    if (current.state === "live") {
      return {
        state: "live",
        error: null,
        installed_at: current.installed_at || now,
        updated_at: now,
      };
    }
    if (authRequired) {
      return {
        state: "needs_auth",
        error: null,
        installed_at: current.installed_at || now,
        updated_at: now,
      };
    }
    return {
      state: "live",
      error: null,
      installed_at: current.installed_at || now,
      updated_at: now,
    };
  }

  return assertNeverCommand(command);
}

module.exports = {
  emptyInstall,
  transition,
};
