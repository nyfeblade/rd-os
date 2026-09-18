"use strict";

const DEFAULT_CHROME = ["chat", "board"];

const CODE_PANE = {
  pane: "code",
  fence: "studio/github",
  draw: "on-demand",
  default_visible: false,
  three_pane_always: false,
  default_chrome: DEFAULT_CHROME.slice(),
  owns: ["repo-switcher", "file-tree", "file-preview", "pr-list", "connector-attach"],
  does_not_own: ["shell", "chat", "board", "titlebar", "presence", "connectors-tray"],
};

function codePaneContract() {
  return {
    pane: CODE_PANE.pane,
    fence: CODE_PANE.fence,
    draw: CODE_PANE.draw,
    default_visible: CODE_PANE.default_visible,
    three_pane_always: CODE_PANE.three_pane_always,
    default_chrome: CODE_PANE.default_chrome.slice(),
    owns: CODE_PANE.owns.slice(),
    does_not_own: CODE_PANE.does_not_own.slice(),
  };
}

function drawCodePane() {
  return {
    ok: true,
    data: Object.assign(codePaneContract(), { visible: true }),
    stop: false,
  };
}

function hideCodePane() {
  return {
    ok: true,
    data: Object.assign(codePaneContract(), { visible: false }),
    stop: false,
  };
}

module.exports = {
  CODE_PANE,
  DEFAULT_CHROME,
  codePaneContract,
  drawCodePane,
  hideCodePane,
};
