"use strict";

const { reject } = require("./codes");

function emptyBinds() {
  return {
    chat_thread_id: null,
    board_card_id: null,
  };
}

function parseBindNotes(input) {
  const source = input && typeof input === "object" ? input : {};
  const chat = source.chat_thread_id;
  const board = source.board_card_id;
  if (chat != null && typeof chat !== "string") {
    return reject("INVALID_GATE", "chat_thread_id must be a string or null");
  }
  if (board != null && typeof board !== "string") {
    return reject("INVALID_GATE", "board_card_id must be a string or null");
  }
  return {
    ok: true,
    data: {
      chat_thread_id: chat || null,
      board_card_id: board || null,
    },
  };
}

module.exports = {
  emptyBinds,
  parseBindNotes,
};
