export const ROUTES = {
  waiting: "/waiting",
  experiments: "/experiments",
  history: "/history",
  settings: "/settings",
} as const;

export type RouteName = keyof typeof ROUTES;

export type AppRoute =
  | { name: "waiting" }
  | { name: "experiments" }
  | { name: "detail"; id: string }
  | { name: "history" }
  | { name: "settings" };

export function experimentPath(id: string): string {
  return `${ROUTES.experiments}/${encodeURIComponent(id)}`;
}

export function parsePath(pathname: string): AppRoute {
  if (pathname === "/" || pathname === ROUTES.waiting) {
    return { name: "waiting" };
  }
  if (pathname === ROUTES.experiments) {
    return { name: "experiments" };
  }
  const detail = pathname.match(/^\/experiments\/([^/]+)$/);
  if (detail && detail[1]) {
    return { name: "detail", id: decodeURIComponent(detail[1]) };
  }
  if (pathname === ROUTES.history) {
    return { name: "history" };
  }
  if (pathname === ROUTES.settings) {
    return { name: "settings" };
  }
  return { name: "waiting" };
}

export function assertNeverRoute(name: never): never {
  throw new Error(`unhandled route: ${String(name)}`);
}
