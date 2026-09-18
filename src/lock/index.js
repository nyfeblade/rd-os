"use strict";

// One-writer lock. Other CAs call acquire/release/requireWriter with a board db.
// Writes without a matching lock_token are LOCK_REQUIRED. A second holder is LOCK_HELD.

const crypto = require("crypto");

const BOARD_RESOURCE = "board";

function reject(code, detail) {
  return { ok: false, code, detail };
}

function ok(data) {
  return { ok: true, data };
}

function resourceOf(payload) {
  return (payload && payload.resource) || BOARD_RESOURCE;
}

function holderOf(payload, ctx) {
  if (payload && typeof payload.holder === "string" && payload.holder.trim()) {
    return payload.holder.trim();
  }
  if (ctx && typeof ctx.actor === "string" && ctx.actor.trim()) {
    return ctx.actor.trim();
  }
  return "agent";
}

function tokenOf(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (typeof payload.lock_token === "string" && payload.lock_token.trim()) {
    return payload.lock_token.trim();
  }
  if (typeof payload.token === "string" && payload.token.trim()) {
    return payload.token.trim();
  }
  return null;
}

function loadLock(db, resource) {
  return db.prepare("SELECT resource, holder, token, acquired_at FROM locks WHERE resource = ?").get(resource) || null;
}

function acquire(db, payload, ctx) {
  const resource = resourceOf(payload);
  const holder = holderOf(payload, ctx);
  const existing = loadLock(db, resource);
  if (existing) {
    if (existing.holder === holder) {
      return ok({
        resource: existing.resource,
        holder: existing.holder,
        token: existing.token,
        acquired_at: existing.acquired_at,
        refreshed: true,
      });
    }
    return reject("LOCK_HELD", `${resource} held by ${existing.holder}; one writer`);
  }
  const token = `lk-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const acquiredAt = new Date().toISOString();
  db.prepare("INSERT INTO locks (resource, holder, token, acquired_at) VALUES (?, ?, ?, ?)").run(
    resource,
    holder,
    token,
    acquiredAt
  );
  return ok({
    resource,
    holder,
    token,
    acquired_at: acquiredAt,
    refreshed: false,
  });
}

function release(db, payload, ctx) {
  const resource = resourceOf(payload);
  const holder = holderOf(payload, ctx);
  const token = tokenOf(payload);
  const existing = loadLock(db, resource);
  if (!existing) {
    return reject("LOCK_REQUIRED", `no lock on ${resource}`);
  }
  if (existing.token !== token || existing.holder !== holder) {
    return reject("LOCK_HELD", "release requires the holder and lock_token");
  }
  db.prepare("DELETE FROM locks WHERE resource = ?").run(resource);
  return ok({ resource, released: true, holder });
}

function requireWriter(db, payload) {
  const resource = resourceOf(payload);
  const token = tokenOf(payload);
  const existing = loadLock(db, resource);
  if (!existing) {
    return reject("LOCK_REQUIRED", `write requires lock.acquire on ${resource}`);
  }
  if (!token || token !== existing.token) {
    return reject("LOCK_REQUIRED", `write requires lock_token for ${resource}`);
  }
  return ok(existing);
}

function listLocks(db) {
  return db.prepare("SELECT resource, holder, token, acquired_at FROM locks ORDER BY resource").all();
}

module.exports = {
  BOARD_RESOURCE,
  acquire,
  release,
  requireWriter,
  loadLock,
  listLocks,
  resourceOf,
  holderOf,
  tokenOf,
};
