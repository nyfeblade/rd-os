"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;

  function connectorClass(status) {
    switch (status) {
      case "live":
        return "live";
      case "needs_auth":
        return "auth";
      case "error":
        return "auth";
      case "disconnected":
        return "auth";
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

  function problemConnectors(connectors, inbox) {
    const rows = connectors.filter((item) => isConnectorProblem(item.status));
    const falsePings = (inbox || []).filter((item) => item && item.need_you === false);
    if (!falsePings.length) {
      return rows;
    }
    return rows.filter((row) => !falsePings.some((item) => item.provider === row.id && !isConnectorProblem(row.status)));
  }

  function problemLabel(connector) {
    switch (connector.status) {
      case "needs_auth":
      case "error":
        return `${connector.label} needs sign-in`;
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
    for (const connector of problemConnectors(state.connectors, state.inbox)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `warn ${connectorClass(connector.status)}`;
      button.dataset.connector = connector.id;
      button.dataset.status = connector.status;
      button.title = connector.status;
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
