import type { AircraftModel, FixedPoint } from "@acars/core";
import { fp, fpScale, fpToNumber, ROUTE_SLOT_FEE, TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useLaunchRoute } from "@/features/network/hooks/useLaunchRoute";
import { findAvailableAircraft } from "@/features/network/utils/launchRoute";
import { DAYS_PER_LEASE_MONTH } from "@/features/network/utils/routeRecommendation";
import { useConfirm } from "@/shared/lib/useConfirm";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(value: FixedPoint): string {
  return money.format(Math.round(fpToNumber(value)));
}

/** Lease deposit charged up front (see fleetSlice.purchaseAircraft). */
export const LEASE_DEPOSIT_SHARE = 0.1;

/** "ATR 72-600", never "ATR ATR 72-600". */
export function modelLabel(model: Pick<AircraftModel, "name" | "manufacturer">): string {
  return model.name.startsWith(model.manufacturer)
    ? model.name
    : `${model.manufacturer} ${model.name}`;
}

export interface LaunchTarget {
  originIata: string;
  destinationIata: string;
  distanceKm: number;
  model: AircraftModel;
}

/**
 * The one-click launch every "launch this route" button uses (airport card,
 * opportunities): ask once with the full cost (slot fee, lease deposit and
 * daily lease, or the idle plane it reuses), then open, lease and assign, and
 * say how it went. Finishes the setup of a route that exists without a plane.
 */
export function useConfirmedLaunch() {
  const { t } = useTranslation(["game"]);
  const confirm = useConfirm();
  const { state, launch } = useLaunchRoute();
  const routes = useAirlineStore((s) => s.routes);
  const fleet = useAirlineStore((s) => s.fleet);

  const launchWithConfirm = useCallback(
    async ({ originIata, destinationIata, distanceKm, model }: LaunchTarget) => {
      const existingRoute = routes.find(
        (route) => route.originIata === originIata && route.destinationIata === destinationIata,
      );
      const reusable = findAvailableAircraft(fleet, { originIata, distanceKm });
      const deliveryMinutes = Math.max(
        1,
        Math.round((model.deliveryTimeTicks / TICKS_PER_HOUR) * 60),
      );
      const slotFee = formatMoney(existingRoute ? fp(0) : ROUTE_SLOT_FEE);
      const approved = await confirm({
        title: t(existingRoute ? "routeCard.finishConfirmTitle" : "routeCard.launchConfirmTitle", {
          ns: "game",
          origin: originIata,
          destination: destinationIata,
        }),
        description: reusable
          ? t("routeCard.reuseConfirmDescription", {
              ns: "game",
              slotFee,
              aircraft: reusable.name,
            })
          : t("routeCard.launchConfirmDescription", {
              ns: "game",
              slotFee,
              model: modelLabel(model),
              deposit: formatMoney(fpScale(model.price, LEASE_DEPOSIT_SHARE)),
              lease: formatMoney(fpScale(model.monthlyLease, 1 / DAYS_PER_LEASE_MONTH)),
              minutes: deliveryMinutes,
            }),
        confirmLabel: t("routeCard.launchConfirmLabel", { ns: "game" }),
      });
      if (!approved) return null;

      const result = await launch({ originIata, destinationIata, distanceKm, model });
      if (result.status === "complete") {
        toast.success(
          t("routeCard.launched", { ns: "game", origin: originIata, destination: destinationIata }),
          {
            description: t("routeCard.launchedDetail", { ns: "game", minutes: deliveryMinutes }),
          },
        );
      } else {
        toast.error(t("routeCard.launchFailed", { ns: "game" }), { description: result.error });
      }
      return result;
    },
    [confirm, launch, t, routes, fleet],
  );

  return { state, launchWithConfirm };
}
