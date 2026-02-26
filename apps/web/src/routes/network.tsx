import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

type NetworkSearch = {
  tab: "active" | "opportunities";
};

export const Route = createFileRoute("/network")({
  component: lazyRouteComponent(() => import("./-network.lazy")),
  validateSearch: (search: Record<string, unknown>): NetworkSearch => {
    return {
      tab: search.tab === "opportunities" ? "opportunities" : "active",
    };
  },
});
