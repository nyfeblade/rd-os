"use strict";

const fs = require("fs");
const path = require("path");
const { createControlPlane } = require("../board");
const { dbPath } = require("../db/sqlite");

function failed(code, detail) {
  return { ok: false, code, detail };
}

function exerciseControlPlane(home) {
  const plane = createControlPlane(home);
  const experimentId = "exp-ca1-control-plane";

  const noLock = plane.thesis.set({
    experiment_id: experimentId,
    title: "ACTIVE thesis without lock",
  });
  if (noLock.ok || noLock.code !== "LOCK_REQUIRED") {
    return failed("LOCK_REQUIRED", `thesis.set without lock: ${JSON.stringify(noLock)}`);
  }

  const writerLock = plane.lock.acquire({ holder: "writer" }, { actor: "writer" });
  if (!writerLock.ok) {
    return failed("LOCK_HELD", `writer acquire failed: ${JSON.stringify(writerLock)}`);
  }
  const writerToken = writerLock.data.token;

  const second = plane.lock.acquire({ holder: "intruder" }, { actor: "intruder" });
  if (second.ok || second.code !== "LOCK_HELD") {
    return failed("LOCK_HELD", `second writer not rejected: ${JSON.stringify(second)}`);
  }

  const thesis = plane.thesis.set({
    experiment_id: experimentId,
    title: "CA1 control plane",
    kill: "board+lock+seat+baseline; clock unarmed",
    instrument: "bin/metrics-baseline.js",
    lock_token: writerToken,
    holder: "writer",
  });
  if (!thesis.ok || !thesis.data.thesis || thesis.data.thesis.status !== "ACTIVE") {
    return failed("MISSING_MACHINE_TIME", `thesis.set: ${JSON.stringify(thesis)}`);
  }

  const packet = plane.packets.upsert({
    packet_id: "pkt-ca1",
    experiment_id: experimentId,
    kind: "run",
    uri: "board/packets/pkt-ca1.json",
    runner_result: "REJECTED",
    estimate_ca_hours: 1,
    estimate_proof_min: 5,
    human_gates: [{ kind: "proof_accept", reason: "Eng Proof owns verdict" }],
    actuals: { ca_hours: null, proof_min: null, human_hours: null, finished_at: null },
    lock_token: writerToken,
    holder: "writer",
  });
  if (!packet.ok) {
    return failed("NO_RESEARCH", `packets.upsert: ${JSON.stringify(packet)}`);
  }

  const authorSeat = plane.seats.assign({
    experiment_id: experimentId,
    seat_actor: "writer",
    role: "author",
    lock_token: writerToken,
    holder: "writer",
  });
  const proofSeat = plane.seats.assign({
    experiment_id: experimentId,
    seat_actor: "eng-proof",
    role: "proof",
    lock_token: writerToken,
    holder: "writer",
  });
  if (!authorSeat.ok || !proofSeat.ok) {
    return failed("SEAT_FORBIDDEN", `seats.assign: ${JSON.stringify({ authorSeat, proofSeat })}`);
  }

  const budget = plane.budget.set({
    experiment_id: experimentId,
    ca_hours_budget: 2,
    proof_min_budget: 25,
    lock_token: writerToken,
    holder: "writer",
  });
  if (!budget.ok) {
    return failed("MISSING_MACHINE_TIME", `budget.set: ${JSON.stringify(budget)}`);
  }

  const authorVerdict = plane.proof.verdict(
    {
      experiment_id: experimentId,
      packet_id: "pkt-ca1",
      verdict: "inconclusive",
      actor: "writer",
      lock_token: writerToken,
      holder: "writer",
    },
    { actor: "writer" }
  );
  if (authorVerdict.ok || authorVerdict.code !== "SEAT_FORBIDDEN") {
    return failed("SEAT_FORBIDDEN", `author proof.verdict: ${JSON.stringify(authorVerdict)}`);
  }

  const released = plane.lock.release({ holder: "writer", lock_token: writerToken }, { actor: "writer" });
  if (!released.ok) {
    return failed("LOCK_REQUIRED", `lock.release: ${JSON.stringify(released)}`);
  }

  const proofLock = plane.lock.acquire({ holder: "eng-proof" }, { actor: "eng-proof" });
  if (!proofLock.ok) {
    return failed("LOCK_HELD", `proof acquire: ${JSON.stringify(proofLock)}`);
  }
  const asProof = plane.proof.verdict(
    {
      experiment_id: experimentId,
      packet_id: "pkt-ca1",
      verdict: "inconclusive",
      actor: "eng-proof",
      lock_token: proofLock.data.token,
      holder: "eng-proof",
    },
    { actor: "eng-proof" }
  );
  if (!asProof.ok || asProof.data.packet.verdict !== "inconclusive") {
    return failed("SEAT_FORBIDDEN", `proof.verdict: ${JSON.stringify(asProof)}`);
  }
  plane.lock.release({ holder: "eng-proof", lock_token: proofLock.data.token }, { actor: "eng-proof" });

  const dump = plane.dump();
  if (!dump.ok || dump.data.thesis.status !== "ACTIVE" || dump.data.packets.length !== 1) {
    return failed("NO_RESEARCH", `board.dump incomplete: ${JSON.stringify(dump)}`);
  }

  const sqlite = dbPath(home);
  if (!fs.existsSync(sqlite)) {
    return failed("NO_RESEARCH", `missing SQLite board at ${sqlite}`);
  }

  return {
    ok: true,
    data: {
      lock_required: true,
      one_writer: true,
      author_verdict_rejected: true,
      proof_packet_verdict: "inconclusive",
      thesis: dump.data.thesis,
      packets_n: dump.data.packets.length,
      seats_n: dump.data.seats.length,
      budgets_n: dump.data.budgets.length,
      sqlite: path.relative(home, sqlite) || "board/control-plane.sqlite",
    },
  };
}

module.exports = {
  exerciseControlPlane,
};
