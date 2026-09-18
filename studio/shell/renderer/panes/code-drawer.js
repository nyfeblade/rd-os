"use strict";

(function attachCodeDrawer(Studio) {
  const assertNever = Studio.assertNever;

  const FILES = [
    {
      id: "shell",
      tab: "StudioShell.tsx",
      lines: [
        { kind: "del", text: "- always show code" },
        { kind: "add", text: "+ open only when needed" },
        { kind: "plain", text: "" },
        { kind: "plain", text: "export function StudioShell() {" },
        { kind: "plain", text: "  return <ChatAndBoard />" },
        { kind: "plain", text: "}" },
      ],
    },
    {
      id: "board",
      tab: "BoardPane.tsx",
      lines: [
        { kind: "plain", text: "// gates live on the board — not a Waiting home" },
        { kind: "plain", text: "export function BoardPane() {" },
        { kind: "plain", text: "  return <Gates />" },
        { kind: "plain", text: "}" },
      ],
    },
  ];

  function lineClass(kind) {
    switch (kind) {
      case "add":
        return "add";
      case "del":
        return "del";
      case "plain":
        return "";
      default:
        return assertNever(kind);
    }
  }

  function selectedFile(state) {
    return FILES.find((file) => file.id === state.selectedFile) || FILES[0];
  }

  function setCodeOpen(els, state, open) {
    state.codeOpen = open;
    els.main.classList.toggle("code-open", open);
    els.codePane.hidden = !open;
    els.btnCode.classList.toggle("on", open);
    els.btnCode.setAttribute("aria-pressed", open ? "true" : "false");
    if (els.codeHint) {
      els.codeHint.hidden = true;
    }
    if (open) {
      renderCode(els, state);
    }
  }

  function renderCode(els, state) {
    const current = selectedFile(state);
    if (els.fileTree) {
      els.fileTree.hidden = true;
      els.fileTree.replaceChildren();
    }
    els.editorTab.textContent = current.tab;
    els.editorBody.replaceChildren();
    for (const line of current.lines) {
      const span = document.createElement("span");
      const cls = lineClass(line.kind);
      if (cls) {
        span.className = cls;
      }
      span.textContent = line.text;
      els.editorBody.append(span, document.createTextNode("\n"));
    }
  }

  Studio.panes = Studio.panes || {};
  Studio.panes.FILES = FILES;
  Studio.panes.setCodeOpen = setCodeOpen;
  Studio.panes.renderCode = renderCode;
})(globalThis.StudioShell = globalThis.StudioShell || {});
