import { NavLink } from "react-router-dom";
import { ROUTES } from "./routes";

type NavProps = {
  status: string;
};

export function Nav({ status }: NavProps) {
  return (
    <nav className="tabs" aria-label="Primary">
      <NavLink to={ROUTES.waiting} end>
        Waiting
      </NavLink>
      <NavLink to={ROUTES.experiments}>Experiments</NavLink>
      <NavLink to={ROUTES.history}>History</NavLink>
      <NavLink to={ROUTES.settings}>Settings</NavLink>
      <span className="meta" data-testid="dump-status">
        {status}
      </span>
    </nav>
  );
}
