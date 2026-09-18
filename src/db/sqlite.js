"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { resolveHome } = require("../store");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

function dbPath(homeArg) {
  return path.join(resolveHome(homeArg), "board", "control-plane.sqlite");
}

function openDb(homeArg) {
  const abs = dbPath(homeArg);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const db = new Database(abs);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

module.exports = {
  dbPath,
  openDb,
};
