import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PanelLoadingState } from "@/shared/components/layout/PanelLoadingState";

// The Cockpit + Ramp kit on one page (S59): a visual reference for building
// screens and for the screenshot audit. Not linked from the game.
export const Route = createFileRoute("/kit")({
  component: lazyRouteComponent(() => import("./-kit.lazy")),
  pendingComponent: PanelLoadingState,
});
