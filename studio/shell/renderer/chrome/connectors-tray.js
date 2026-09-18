"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;

  function connectorClass(status) {
    switch (status) {
      case "live":
        return "chip conn live";
      case "needs_auth":
        return "chip conn auth";
      case "disconnected":
        return "chip conn off";
      case "error":
        return "chip conn err";
      default:
        return assertNever(status);
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
      button.textContent = connector.label;
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "chip conn";
    add.dataset.connector = "add";
    add.textContent = "+";
    add.setAttribute("aria-label", "Connect another provider");
    add.addEventListener("click", () => onConnector("add"));
    els.connectors.appendChild(add);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
