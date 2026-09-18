import { Link } from "react-router-dom";
import { ROUTES } from "../shell/routes";

export function ExperimentsView() {
  return (
    <section className="stub" data-testid="experiments-stub">
      <h1>Experiments</h1>
      <p className="quiet">
        Stub. Open, finished, and killed rows will list here. This shell reads{" "}
        <code>attention.dump</code> only — it does not store experiments.
      </p>
      <div className="actions">
        <Link to={ROUTES.waiting}>Back to Waiting</Link>
      </div>
    </section>
  );
}
