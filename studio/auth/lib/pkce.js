"use strict";

const crypto = require("crypto");

function base64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomVerifier() {
  return base64Url(crypto.randomBytes(32));
}

function challengeS256(verifier) {
  return base64Url(crypto.createHash("sha256").update(verifier, "ascii").digest());
}

function randomState() {
  return crypto.randomBytes(24).toString("hex");
}

function createPkce() {
  const verifier = randomVerifier();
  return {
    verifier,
    challenge: challengeS256(verifier),
    method: "s256",
  };
}

module.exports = {
  base64Url,
  randomVerifier,
  challengeS256,
  randomState,
  createPkce,
};
