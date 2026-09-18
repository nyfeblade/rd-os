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

  function isConnectorProblem(status) {
    switch (status) {
      case "needs_auth":
      case "error":
        return true;
      case "live":
      case "disconnected":
        return false;
      default:
        return assertNever(status);
    }
  }

  function problemConnectors(connectors) {
    return connectors.filter((item) => isConnectorProblem(item.status));
  }

  function problemLabel(connector) {
    switch (connector.status) {
      case "needs_auth":
        return `${connector.label} needs sign-in`;
      case "error":
        return `${connector.label} error`;
      case "live":
      case "disconnected":
        return connector.label;
      default:
        return assertNever(connector.status);
    }
  }

  function renderConnectors(els, state, onConnector) {
    els.connectors.replaceChildren();
    if (state.view === "cold") {
      return;
    }
    for (const connector of problemConnectors(state.connectors)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "warn";
      button.dataset.connector = connector.id;
      button.dataset.status = connector.status;
      button.title = "needs attention";
      button.setAttribute("aria-label", problemLabel(connector));
      button.textContent = problemLabel(connector);
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.problemConnectors = problemConnectors;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
