"use strict";

const fs = require("fs");
const path = require("path");
const { reject, ok } = require("./errors");

const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8"));
}

function sortEntries(entries) {
  return entries.slice().sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "dir" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function createFixtureBrowse() {
  const repo = loadJson("repo.json");
  const trees = loadJson("entries.json");
  const blobs = loadJson("blobs.json");
  const pulls = loadJson("pulls.json");

  function tree(dirPath) {
    const key = String(dirPath || "").replace(/^\/+|\/+$/g, "");
    if (!Object.prototype.hasOwnProperty.call(trees, key)) {
      return reject("UNKNOWN_PATH", `${key || "/"} is not on the fixture tree`);
    }
    return ok(sortEntries(trees[key]));
  }

  function blob(filePath) {
    const key = String(filePath || "").replace(/^\/+/, "");
    if (!Object.prototype.hasOwnProperty.call(blobs, key)) {
      return reject("UNKNOWN_PATH", `${key} is not a fixture blob`);
    }
    const content = blobs[key];
    return ok({
      path: key,
      name: key.split("/").pop(),
      encoding: "utf-8",
      content,
      size: content.length,
      sha: "fixture",
    });
  }

  return {
    repo: () => ok(repo),
    tree,
    blob,
    pulls: () => ok(pulls),
  };
}

module.exports = {
  FIXTURE_DIR,
  loadJson,
  sortEntries,
  createFixtureBrowse,
};
