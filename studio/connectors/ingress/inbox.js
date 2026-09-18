"use strict";

/**
 * Minimal inbox consumer surface — in-memory list + optional file dump.
 * Shell requires ingest(); this dump is what a stranger can cat after prove.
 * No chrome. No tray UI.
 */

const fs = require("fs");
const path = require("path");

function Inbox() {
  this.items = [];
}

Inbox.prototype.push = function push(item) {
  if (!item || typeof item !== "object") return this.items.length;
  this.items.push(item);
  return this.items.length;
};

Inbox.prototype.list = function list() {
  return this.items.slice();
};

Inbox.prototype.clear = function clear() {
  this.items = [];
};

Inbox.prototype.dump = function dump() {
  return {
    items: this.list(),
    count: this.items.length,
    verdict: null,
    clock_started: false,
  };
};

Inbox.prototype.write = function write(filePath) {
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(this.dump(), null, 2)}\n`);
  return abs;
};

module.exports = { Inbox };
