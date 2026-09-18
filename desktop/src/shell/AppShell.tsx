import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { formatDumpAge } from "../lib/copy";
import { applySettings, loadSettings } from "../lib/settings";
import { useDump } from "../lib/useDump";
import { ExperimentDetailView } from "../views/ExperimentDetailView";
import { ExperimentsView } from "../views/ExperimentsView";
import { HistoryView } from "../views/HistoryView";
import { SettingsView } from "../views/SettingsView";
import { WaitingView } from "../views/WaitingView";
import { Nav } from "./Nav";
import { ROUTES } from "./routes";

export function AppShell() {
  const { state, retry } = useDump();
  const location = useLocation();

  useEffect(() => {
    applySettings(loadSettings());
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      const sheet = document.querySelector("[role=dialog]");
      if (sheet) {
        return;
      }
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) {
        focused.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const status = statusLabel(state);

  return (
    <div className="wrap">
      <div className="panel">
        <Nav status={status} />
        {state.status === "loading" ? <LoadingRows /> : null}
        {state.status === "missing" && location.pathname === ROUTES.waiting ? (
          <BoardError path={state.path} home={state.home} detail={state.detail} onRetry={retry} />
        ) : null}
        {state.status === "ok" || (state.status === "missing" && location.pathname !== ROUTES.waiting) ? (
          <Routes>
            <Route path="/" element={<Navigate to={ROUTES.waiting} replace />} />
            <Route
              path={ROUTES.waiting}
              element={
                state.status === "ok" ? (
                  <WaitingView dump={state.dump} onReload={retry} />
                ) : (
                  <Navigate to={ROUTES.waiting} replace />
                )
              }
            />
            <Route path={ROUTES.experiments} element={<ExperimentsView />} />
            <Route path={`${ROUTES.experiments}/:id`} element={<ExperimentDetailView />} />
            <Route path={ROUTES.history} element={<HistoryView />} />
            <Route path={ROUTES.settings} element={<SettingsView />} />
            <Route path="*" element={<Navigate to={ROUTES.waiting} replace />} />
          </Routes>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(state: ReturnType<typeof useDump>["state"]): string {
  switch (state.status) {
    case "loading":
      return "…";
    case "missing":
      return "—";
    case "ok":
      return formatDumpAge(state.mtimeMs == null ? 0 : Date.now() - state.mtimeMs);
    default: {
      const neverState: never = state;
      throw new Error(`unhandled dump status: ${JSON.stringify(neverState)}`);
    }
  }
}

function LoadingRows() {
  return (
    <div data-testid="waiting-loading" aria-busy="true">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}

type BoardErrorProps = {
  path: string;
  home: string | null;
  detail: string;
  onRetry: () => void;
};

function BoardError({ path, home, detail, onRetry }: BoardErrorProps) {
  return (
    <section className="error" data-testid="board-error">
      <h1>Can’t reach the board</h1>
      <p className="quiet">
        The lab did not return attention.dump. Nothing was invented.
      </p>
      <p className="quiet path-hint">
        Looked for <code>{path}</code>
        {home ? (
          <>
            {" "}
            under <code>{home}</code>
          </>
        ) : null}
        . {detail}
      </p>
      <div className="actions">
        <button className="secondary" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  );
}
