"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;

  function connectorClass(status) {
    switch (status) {
      case "connected":
        return "chip on";
      case "needs-auth":
        return "chip";
      case "add":
        return "chip";
      default:
        return assertNever(status);
    }
  }

  function renderConnectors(els, state, onConnector) {
    els.connectors.replaceChildren();
    const connected = state.connectors.some((item) => item.status === "connected");
    if (!connected) {
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
      button.textContent = connector.label;
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
