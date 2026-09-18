import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import "./styles/tokens.css";
import "./styles/shell.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AppShell />
    </HashRouter>
  </StrictMode>,
);
