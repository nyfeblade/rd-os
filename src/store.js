"use strict";

const fs = require("fs");
const path = require("path");

const BOARD_EXPERIMENTS = "board/experiments";
const BOARD_PACKETS = "board/packets";
const BOARD_ATTENTION = "board/attention.dump.json";
const BOARD_SESSION = "board/session.json";
const ENVELOPE_DIR = "envelope/baselines";

function resolveHome(home) {
  if (home) {
    return path.resolve(home);
  }
  if (process.env.RDOS_HOME) {
    return path.resolve(process.env.RDOS_HOME);
  }
  return path.resolve(process.cwd(), "var");
}

function ensureDirs(home) {
  for (const rel of [BOARD_EXPERIMENTS, BOARD_PACKETS, ENVELOPE_DIR, "board"]) {
    fs.mkdirSync(path.join(home, rel), { recursive: true });
  }
}

function readJson(abs, fallback) {
  if (!fs.existsSync(abs)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(abs, value) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function createStore(homeArg) {
  const home = resolveHome(homeArg);
  ensureDirs(home);

  return {
    home,
    experimentPath(id) {
      return path.join(home, BOARD_EXPERIMENTS, `${id}.json`);
    },
    packetPath(id) {
      return path.join(home, BOARD_PACKETS, `${id}.json`);
    },
    attentionPath() {
      return path.join(home, BOARD_ATTENTION);
    },
    sessionPath() {
      return path.join(home, BOARD_SESSION);
    },
    envelopePath(id) {
      return path.join(home, ENVELOPE_DIR, `${id}.json`);
    },
    loadExperiment(id) {
      return readJson(this.experimentPath(id), null);
    },
    saveExperiment(experiment) {
      writeJson(this.experimentPath(experiment.experiment_id), experiment);
      return rel(home, this.experimentPath(experiment.experiment_id));
    },
    listExperiments() {
      const dir = path.join(home, BOARD_EXPERIMENTS);
      if (!fs.existsSync(dir)) {
        return [];
      }
      return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => readJson(path.join(dir, name), null))
        .filter(Boolean);
    },
    savePacket(id, packet) {
      writeJson(this.packetPath(id), packet);
      return rel(home, this.packetPath(id));
    },
    loadPacket(id) {
      return readJson(this.packetPath(id), null);
    },
    listPackets() {
      const dir = path.join(home, BOARD_PACKETS);
      if (!fs.existsSync(dir)) {
        return [];
      }
      return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => readJson(path.join(dir, name), null))
        .filter(Boolean);
    },
    saveAttention(dump) {
      writeJson(this.attentionPath(), dump);
      return rel(home, this.attentionPath());
    },
    loadAttention() {
      return readJson(this.attentionPath(), null);
    },
    loadSession() {
      return readJson(this.sessionPath(), { envelope_queries: [] });
    },
    saveSession(session) {
      writeJson(this.sessionPath(), session);
    },
    recordEnvelopeQuery(query) {
      const session = this.loadSession();
      session.envelope_queries.push(query);
      this.saveSession(session);
      return query;
    },
    hasEnvelopeQuery(id) {
      const session = this.loadSession();
      return session.envelope_queries.some((query) => query.id === id);
    },
    listBaselines() {
      const dir = path.join(home, ENVELOPE_DIR);
      if (!fs.existsSync(dir)) {
        return [];
      }
      return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => readJson(path.join(dir, name), null))
        .filter(Boolean);
    },
    saveBaseline(baseline) {
      writeJson(this.envelopePath(baseline.experiment_id), baseline);
      return rel(home, this.envelopePath(baseline.experiment_id));
    },
  };
}

function rel(home, absPath) {
  return path.relative(home, absPath) || ".";
}

module.exports = {
  createStore,
  resolveHome,
};
