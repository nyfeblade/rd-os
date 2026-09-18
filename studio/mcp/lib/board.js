"use strict";

const { ok, BOARD_GATES_SCHEMA } = require("./codes");

const BOARD_GATES_TODO =
  "TODO: bind studio.board.list_gates to a Board dump/gates export (P0 / waiting-on / HITL pending). Do not invent gate rows. Do not scrape studio/shell chrome.";

function listGates() {
  return ok({
    schema: BOARD_GATES_SCHEMA,
    stub: true,
    status: "BOARD_UNBOUND",
    reason:
      "Board gates are not an importable module from the studio/mcp fence. Shell chrome is out of fence. This tool returns the empty contract, not planted gates.",
    todo: BOARD_GATES_TODO,
    gates: [],
    hitl: {
      merge: "Board Approve required",
      deploy: "Board Approve required",
      db: "Board Approve required",
      public_post: "in-studio-only cutover attached AND Board Approve required",
    },
    clock_started: false,
    verdict: null,
  });
}

module.exports = {
  BOARD_GATES_TODO,
  listGates,
};
