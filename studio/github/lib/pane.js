"use strict";

const CODE_PANE = {
  pane: "code",
  fence: "studio/github",
  draw: "on-demand",
  owns: ["repo-switcher", "file-tree", "file-preview", "pr-list", "connector-attach"],
  does_not_own: ["shell", "chat", "board", "titlebar", "presence", "connectors-tray"],
};

function codePaneContract() {
  return Object.assign({}, CODE_PANE, {
    owns: CODE_PANE.owns.slice(),
    does_not_own: CODE_PANE.does_not_own.slice(),
  });
}

module.exports = {
  CODE_PANE,
  codePaneContract,
};
