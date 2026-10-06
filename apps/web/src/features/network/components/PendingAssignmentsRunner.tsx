import { useAirlineStore } from "@acars/store";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  loadPendingAssignments,
  PENDING_ASSIGNMENTS_EVENT,
  resolvePendingAssignments,
  savePendingAssignments,
} from "@/features/network/utils/pendingAssignments";

/**
 * Publishes queued ferry-and-assign assignments once their aircraft have
 * landed. Mounted once at the app root; renders nothing.
 */
export function PendingAssignmentsRunner() {
  const { t } = useTranslation("game");
  const pubkey = useAirlineStore((s) => s.pubkey);
  const fleet = useAirlineStore((s) => s.fleet);
  const routes = useAirlineStore((s) => s.routes);
  const assignAircraftToRoute = useAirlineStore((s) => s.assignAircraftToRoute);
  const [version, setVersion] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(PENDING_ASSIGNMENTS_EVENT, bump);
    return () => window.removeEventListener(PENDING_ASSIGNMENTS_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!pubkey || running.current) return;
    const pending = loadPendingAssignments(pubkey);
    if (pending.length === 0) return;
    const { ready, waiting } = resolvePendingAssignments(pending, fleet, routes);
    if (ready.length === 0) {
      if (waiting.length !== pending.length) savePendingAssignments(pubkey, waiting);
      return;
    }
    running.current = true;
    savePendingAssignments(pubkey, waiting);
    void (async () => {
      for (const entry of ready) {
        const aircraft = fleet.find((a) => a.id === entry.aircraftId);
        const route = routes.find((r) => r.id === entry.routeId);
        try {
          await assignAircraftToRoute(entry.aircraftId, entry.routeId);
          toast.success(
            t("assign.assigned", {
              aircraft: aircraft?.name ?? entry.aircraftId,
              origin: route?.originIata ?? "",
              destination: route?.destinationIata ?? "",
            }),
          );
        } catch (error) {
          toast.error(t("assign.failed"), {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      }
      running.current = false;
    })();
  }, [pubkey, fleet, routes, assignAircraftToRoute, t, version]);

  return null;
}
