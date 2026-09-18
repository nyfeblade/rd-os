"use strict";

/**
 * Consume-only. Reads studio/connectors/ingress when present.
 * This lane never writes studio/connectors/**.
 */

const fs = require("node:fs");
const path = require("node:path");

const INGRESS_REL = "studio/connectors/ingress";

function ingressPath() {
  return path.resolve(__dirname, "..", "..", "connectors", "ingress", "index.js");
}

function ingressPresent() {
  return fs.existsSync(ingressPath());
}

function tryLoadIngress() {
  if (!ingressPresent()) {
    return null;
  }
  return require("../../connectors/ingress");
}

function ingressFixturesDir() {
  return path.resolve(__dirname, "..", "..", "connectors", "ingress", "fixtures", "good");
}

function readIngressFixture(name) {
  const file = path.join(ingressFixturesDir(), name);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = {
  INGRESS_REL,
  ingressPath,
  ingressPresent,
  ingressFixturesDir,
  readIngressFixture,
  tryLoadIngress,
};
