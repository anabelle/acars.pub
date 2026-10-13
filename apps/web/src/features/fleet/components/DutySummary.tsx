import type { AircraftInstance, Route } from "@acars/core";
import { CalendarClock, ParkingSquare, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { aircraftDuty } from "../utils/duty";

/** One line saying what a plane is doing: its day plan, its route, or parked. */
export function DutySummary({
  aircraft,
  routes,
  className = "",
}: {
  aircraft: Pick<AircraftInstance, "assignedRouteId" | "line" | "baseAirportIata">;
  routes: readonly Route[];
  className?: string;
}) {
  const { t } = useTranslation("game");
  const duty = aircraftDuty(aircraft, (id) => routes.find((route) => route.id === id));
  const Icon =
    duty.kind === "line" ? CalendarClock : duty.kind === "route" ? Repeat : ParkingSquare;
  const text =
    duty.kind === "line"
      ? t("duty.line", { path: duty.airports.join(" → ") })
      : duty.kind === "route"
        ? t("duty.route", {
            origin: duty.route.originIata,
            destination: duty.route.destinationIata,
          })
        : t("duty.parked", { airport: duty.airport });
  return (
    <p
      data-testid="aircraft-duty"
      data-duty={duty.kind}
      className={`flex items-start gap-1.5 text-xs font-semibold ${duty.kind === "parked" ? "text-amber-300" : "text-foreground"} ${className}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
