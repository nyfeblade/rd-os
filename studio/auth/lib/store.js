"use strict";

const fs = require("fs");
const path = require("path");
const { ok, reject, isObject } = require("./result");
const { SCHEMA } = require("./codes");

function layout(home) {
  return {
    home,
    session: path.join(home, "session.json"),
    pending: path.join(home, "pending.json"),
  };
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch (_err) {}
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { ok: false, missing: true };
    }
    return reject("STORE_CORRUPT", err && err.message ? err.message : String(err));
  }
}

function removeFile(file) {
  try {
    fs.unlinkSync(file);
  } catch (err) {
    if (!err || err.code !== "ENOENT") {
      throw err;
    }
  }
}

function saveSession(home, record) {
  writeJsonAtomic(layout(home).session, record);
  return ok(record);
}

function loadSession(home) {
  const file = layout(home).session;
  const loaded = readJson(file);
  if (!loaded.ok) {
    if (loaded.missing) {
      return ok(null);
    }
    return loaded;
  }
  if (!isObject(loaded.data) || loaded.data.schema !== SCHEMA) {
    return reject("STORE_CORRUPT", "session.json failed schema check");
  }
  return ok(loaded.data);
}

function savePending(home, pending) {
  writeJsonAtomic(layout(home).pending, pending);
  return ok(pending);
}

function loadPending(home) {
  const file = layout(home).pending;
  const loaded = readJson(file);
  if (!loaded.ok) {
    if (loaded.missing) {
      return ok(null);
    }
    return loaded;
  }
  if (!isObject(loaded.data) || loaded.data.schema !== SCHEMA) {
    return reject("STORE_CORRUPT", "pending.json failed schema check");
  }
  return ok(loaded.data);
}

function clearPending(home) {
  removeFile(layout(home).pending);
}

function clearAll(home) {
  const paths = layout(home);
  removeFile(paths.session);
  removeFile(paths.pending);
}

module.exports = {
  layout,
  writeJsonAtomic,
  readJson,
  saveSession,
  loadSession,
  savePending,
  loadPending,
  clearPending,
  clearAll,
};
