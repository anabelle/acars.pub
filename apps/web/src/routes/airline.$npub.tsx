import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PanelLoadingState } from "@/shared/components/layout/PanelLoadingState";

export const Route = createFileRoute("/airline/$npub")({
  component: lazyRouteComponent(() => import("./-airline.$npub.lazy")),
  pendingComponent: PanelLoadingState,
});
