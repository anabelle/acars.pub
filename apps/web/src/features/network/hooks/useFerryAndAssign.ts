import type { AircraftInstance, Route } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  loadPendingAssignments,
  PENDING_ASSIGNMENTS_EVENT,
  savePendingAssignments,
  withPending,
} from "@/features/network/utils/pendingAssignments";
import { useConfirm } from "@/shared/lib/useConfirm";

/**
 * Ferry-and-assign behind one confirm (S25): publishes the ferry now and
 * queues the assignment, which `PendingAssignmentsRunner` publishes when
 * the aircraft lands. Resolves to whether the ferry was sent.
 */
export function useFerryAndAssign() {
  const { t } = useTranslation("game");
  const confirm = useConfirm();
  const ferryAircraft = useAirlineStore((s) => s.ferryAircraft);
  const pubkey = useAirlineStore((s) => s.pubkey);

  return useCallback(
    async (aircraft: AircraftInstance, route: Route, ferryTo: string, ferryKm: number) => {
      const approved = await confirm({
        title: t("assign.ferryConfirmTitle"),
        description: t("assign.ferryConfirmDescription", {
          aircraft: aircraft.name,
          from: aircraft.baseAirportIata,
          to: ferryTo,
          km: ferryKm.toLocaleString(),
          origin: route.originIata,
          destination: route.destinationIata,
        }),
        confirmLabel: t("assign.ferryAndAssign"),
      });
      if (!approved || !pubkey) return false;
      try {
        await ferryAircraft(aircraft.id, ferryTo);
      } catch (error) {
        toast.error(t("assign.ferryFailed"), {
          description: error instanceof Error ? error.message : undefined,
        });
        return false;
      }
      savePendingAssignments(
        pubkey,
        withPending(loadPendingAssignments(pubkey), {
          aircraftId: aircraft.id,
          routeId: route.id,
          ferryTo,
        }),
      );
      window.dispatchEvent(new Event(PENDING_ASSIGNMENTS_EVENT));
      toast.success(
        t("assign.ferrying", {
          aircraft: aircraft.name,
          to: ferryTo,
          origin: route.originIata,
          destination: route.destinationIata,
        }),
      );
      return true;
    },
    [confirm, ferryAircraft, pubkey, t],
  );
}
