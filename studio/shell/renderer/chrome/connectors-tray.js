"use strict";

(function attachConnectorsTray(Studio) {
  const assertNever = Studio.assertNever;
  const P0_UX = ["github", "slack"];

  function connectorClass(status) {
    switch (status) {
      case "live":
        return "live";
      case "needs_auth":
        return "auth";
      case "error":
        return "error";
      case "disconnected":
        return "off";
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

  function p0TrayRows(connectors) {
    return (connectors || []).filter((item) => P0_UX.includes(item.id));
  }

  function problemConnectors(connectors, inbox) {
    const rows = p0TrayRows(connectors).filter((item) => isConnectorProblem(item.status));
    const falsePings = (inbox || []).filter((item) => item && item.need_you === false);
    if (!falsePings.length) {
      return rows;
    }
    return rows.filter((row) => !falsePings.some((item) => item.provider === row.id && item.need_you === false && row.status === "live"));
  }

  function trayLabel(connector) {
    switch (connector.status) {
      case "needs_auth":
        return `${connector.label} · sign in`;
      case "error":
        return `${connector.label} · error`;
      case "live":
        return connector.label;
      case "disconnected":
        return connector.label;
      default:
        return assertNever(connector.status);
    }
  }

  function renderConnectors(els, state, onConnector) {
    els.connectors.replaceChildren();
    for (const connector of p0TrayRows(state.connectors)) {
      if (connector.status === "disconnected") {
        continue;
      }
      if (connector.need_you === false) {
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = connectorClass(connector.status);
      button.dataset.connector = connector.id;
      button.dataset.status = connector.status;
      button.dataset.inboxEntry = connector.status === "live" || connector.status === "error" ? "true" : "false";
      button.title = connector.status;
      button.setAttribute("aria-label", trayLabel(connector));
      button.setAttribute("aria-pressed", String(state.inboxFilter === connector.id));
      if (state.inboxFilter === connector.id) {
        button.classList.add("on");
      }
      button.textContent = trayLabel(connector);
      button.addEventListener("click", () => onConnector(connector.id));
      els.connectors.appendChild(button);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.dataset.connector = "add";
    add.setAttribute("aria-label", "Marketplace");
    add.textContent = "+";
    add.addEventListener("click", () => onConnector("add"));
    els.connectors.appendChild(add);
  }

  Studio.chrome = Studio.chrome || {};
  Studio.chrome.connectorClass = connectorClass;
  Studio.chrome.p0TrayRows = p0TrayRows;
  Studio.chrome.problemConnectors = problemConnectors;
  Studio.chrome.renderConnectors = renderConnectors;
})(globalThis.StudioShell = globalThis.StudioShell || {});
