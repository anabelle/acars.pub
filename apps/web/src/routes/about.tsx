import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: lazyRouteComponent(() => import("./-about.lazy")),
});
