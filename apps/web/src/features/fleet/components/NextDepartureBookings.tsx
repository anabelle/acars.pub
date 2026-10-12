import type { AircraftInstance } from "@acars/core";
import { useEngineStore } from "@acars/store";
import { useTranslation } from "react-i18next";
import { BookingBar } from "@/features/network/components/BookingBar";
import { formatUtcClock } from "@/features/network/utils/tickerFacts";
import { nextDepartureBookings } from "../utils/bookings";

/**
 * Bookings for the plane's next departure (S70, D13 visual first): seats sold
 * so far, climbing toward departure, and how many are still to sell — late
 * bookers, many of them business. Drawn from the expected load; nothing is
 * simulated and revenue is unchanged.
 */
export function NextDepartureBookingsCard({ aircraft }: { aircraft: AircraftInstance }) {
  const { t } = useTranslation("game");
  const tick = useEngineStore((s) => s.tick);
  const bookings = nextDepartureBookings(aircraft, tick);
  if (!bookings || bookings.seats === 0) return null;
  const percent = Math.round((bookings.booked / bookings.seats) * 100);
  return (
    <div
      data-testid="next-departure-bookings"
      className="rounded-xl border border-border/60 bg-background/90 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {t("bookings.title", { ns: "game", time: formatUtcClock(bookings.departureTick) })}
        </p>
        <div className="w-16">
          <BookingBar percent={percent} filling />
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold">
        {t("bookings.sold", { ns: "game", booked: bookings.booked, seats: bookings.seats })}
      </p>
      {bookings.toSell > 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {bookings.premiumToSell > 0
            ? t("bookings.toSellPremium", {
                ns: "game",
                count: bookings.toSell,
                premium: bookings.premiumToSell,
              })
            : t("bookings.toSell", { ns: "game", count: bookings.toSell })}
        </p>
      ) : null}
    </div>
  );
}
