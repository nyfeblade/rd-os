import { Link, useParams } from "react-router-dom";
import { ROUTES } from "../shell/routes";

export function ExperimentDetailView() {
  const { id } = useParams();
  return (
    <section className="stub" data-testid="experiment-detail-stub">
      <h1>Experiment</h1>
      <p className="quiet">
        Stub for <code>{id || "unknown"}</code>. Machine-time, gates, and claims stay on the
        board — this window does not invent them.
      </p>
      <div className="actions">
        <Link to={ROUTES.experiments}>Experiments</Link>
      </div>
    </section>
  );
}
