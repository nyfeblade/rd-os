"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;

  function connectorClass(status) {
    switch (status) {
      case "live":
        return "live";
      case "needs_auth":
        return "auth";
      case "disconnected":
        return "off";
      case "error":
        return "err";
      default:
        return assertNever(status);
    }
  }

  function iconGlyph(id) {
    switch (id) {
      case "github":
        return "GH";
      case "cursor":
        return "Cu";
      case "claude":
        return "Cl";
      case "grok":
        return "Gr";
      case "linear":
        return "Li";
      case "sentry":
        return "Se";
      case "vercel":
        return "Ve";
      default:
        return String(id).slice(0, 2).toUpperCase();
    }
  }

  function renderConnectors(els, state, onConnector) {
    els.connectors.replaceChildren();
    const live = state.connectors.some((item) => item.status === "live");
    if (!live) {
      const hint = document.createElement("span");
      hint.className = "tray-empty";
      hint.textContent = "Connect GitHub / an agent provider";
      els.connectors.appendChild(hint);
    }
    for (const connector of state.connectors) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = connectorClass(connector.status);
      button.dataset.connector = connector.id;
      button.dataset.status = connector.status;
      button.title = `${connector.label} · ${connector.status}`;
      button.setAttribute("aria-label", `${connector.label} ${connector.status}`);
      button.textContent = iconGlyph(connector.id);
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.dataset.connector = "add";
    add.textContent = "+";
    add.title = "Connect GitHub / an agent provider";
    add.setAttribute("aria-label", "Connect another provider");
    add.addEventListener("click", () => onConnector("add"));
    els.connectors.appendChild(add);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.iconGlyph = iconGlyph;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
