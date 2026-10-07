import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

// S45 prototype: the globe-first shell, behind a feature flag (see playFlag.ts).
export const Route = createFileRoute("/play")({
  component: lazyRouteComponent(() => import("./-play.lazy")),
});
