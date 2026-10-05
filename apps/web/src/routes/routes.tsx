import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveRouteAlias } from "@/shared/lib/routeAliases";

export const Route = createFileRoute("/routes")({
  beforeLoad: ({ search }) => {
    const target = resolveRouteAlias("/routes", search as Record<string, unknown>);
    // The canonical route validates (and defaults) these params itself.
    throw redirect({ to: target.to, search: target.search as never, replace: true });
  },
});
