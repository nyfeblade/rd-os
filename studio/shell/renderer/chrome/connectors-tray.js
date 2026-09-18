"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;

  function connectorClass(status) {
    switch (status) {
      case "live":
        return "ok";
      case "needs_auth":
        return "warn";
      case "disconnected":
        return "bad";
      case "error":
        return "err";
      default:
        return assertNever(status);
    }
  }

  function renderConnectors(els, state, onConnector) {
    els.connectors.replaceChildren();
    if (!state.connectors.length) {
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
      button.textContent = connector.label;
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
