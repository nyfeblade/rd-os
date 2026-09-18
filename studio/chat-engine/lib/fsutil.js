"use strict";

const fs = require("fs");
const path = require("path");
const { ok, reject } = require("./result");

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
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

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch (_err) {
    return false;
  }
}

function confine(root, relOrAbs) {
  if (typeof relOrAbs !== "string" || relOrAbs.trim() === "") {
    return reject("BAD_ARGUMENT", "path is required");
  }
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch (err) {
    return reject("BIND_PATH_MISSING", err && err.message ? err.message : String(err));
  }
  const abs = path.resolve(realRoot, relOrAbs);
  let real = abs;
  try {
    real = fs.realpathSync(abs);
  } catch (_err) {
    const parent = path.dirname(abs);
    try {
      const realParent = fs.realpathSync(parent);
      real = path.join(realParent, path.basename(abs));
    } catch (_inner) {
      real = abs;
    }
  }
  if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) {
    return reject("PATH_OUTSIDE_REPO", `${relOrAbs} is outside ${realRoot}`);
  }
  return ok({
    abs: real,
    rel: path.relative(realRoot, real).split(path.sep).join("/"),
    root: realRoot,
  });
}

module.exports = {
  writeJsonAtomic,
  readJson,
  exists,
  confine,
};
