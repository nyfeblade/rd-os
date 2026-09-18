"use strict";

const crypto = require("crypto");

const THREAD_ID_RE = /^thr_[a-f0-9]{24}$/;
const PROJECT_KEY_RE = /^[a-f0-9]{16}$/;

function makeId(prefix) {
  return prefix + crypto.randomBytes(12).toString("hex");
}

function threadId() {
  return makeId("thr_");
}

function memoryId() {
  return makeId("mem_");
}

function eventId() {
  return makeId("evt_");
}

function handoffId() {
  return makeId("hnd_");
}

function projectKey(gitRoot) {
  return crypto.createHash("sha256").update(String(gitRoot)).digest("hex").slice(0, 16);
}

function isThreadId(value) {
  return typeof value === "string" && THREAD_ID_RE.test(value);
}

function isProjectKey(value) {
  return typeof value === "string" && PROJECT_KEY_RE.test(value);
}

module.exports = {
  threadId,
  memoryId,
  eventId,
  handoffId,
  projectKey,
  isThreadId,
  isProjectKey,
};
