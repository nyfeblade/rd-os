"use strict";

(function attachCodeDrawer(Studio) {
  const FILES = [
    {
      id: "shell",
      tab: "StudioShell.tsx",
      body: "// only here when you asked\nexport function StudioShell() {\n  return <ChatAndBoard />\n}\n",
    },
    {
      id: "board",
      tab: "BoardPane.tsx",
      body: "// gates live on the board — not a Waiting home\nexport function BoardPane() {\n  return <Gates />\n}\n",
    },
  ];

  function selectedFile(state) {
    return FILES.find((file) => file.id === state.selectedFile) || FILES[0];
  }

  function setCodeOpen(els, state, open) {
    state.codeOpen = open;
    els.main.classList.toggle("code-open", open);
    els.codePane.hidden = !open;
    els.btnCode.classList.toggle("on", open);
    els.btnCode.setAttribute("aria-pressed", open ? "true" : "false");
    els.codeHint.hidden = open;
    if (open) {
      renderCode(els, state);
    }
  }

  function renderCode(els, state) {
    const current = selectedFile(state);
    els.fileTree.replaceChildren();
    for (const file of FILES) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = file.id === current.id ? "tree-item on" : "tree-item";
      item.textContent = file.tab;
      item.addEventListener("click", () => {
        state.selectedFile = file.id;
        renderCode(els, state);
      });
      els.fileTree.appendChild(item);
    }
    els.editorTab.replaceChildren();
    const name = document.createElement("b");
    name.textContent = current.tab;
    els.editorTab.appendChild(name);
    els.editorBody.textContent = current.body;
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.FILES = FILES;
  Studio.panes.setCodeOpen = setCodeOpen;
  Studio.panes.renderCode = renderCode;
})(globalThis.StudioShell = globalThis.StudioShell || {});
