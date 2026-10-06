import { type FixedPoint, fpToNumber, type TimelineEvent } from "@acars/core";
import type { MapBurst } from "@acars/map";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** "+$12.3K" / "−$850" for a leg's result (display only). */
export function formatBurstAmount(amount: FixedPoint): string {
  const value = fpToNumber(amount);
  return `${value < 0 ? "−" : "+"}${compactUsd.format(Math.abs(value))}`;
}

/**
 * Map labels for landings among `events`: the leg's profit (else revenue)
 * at the destination airport. Other events, ferries and landings without a
 * known airport or amount give nothing.
 */
export function landingBursts(
  events: readonly TimelineEvent[],
  airportByIata: (iata: string) => { latitude: number; longitude: number } | undefined,
): MapBurst[] {
  const bursts: MapBurst[] = [];
  for (const event of events) {
    if (event.type !== "landing" || !event.destinationIata) continue;
    const amount = event.profit ?? event.revenue;
    if (amount === undefined) continue;
    const airport = airportByIata(event.destinationIata);
    if (!airport) continue;
    bursts.push({
      id: event.id,
      longitude: airport.longitude,
      latitude: airport.latitude,
      text: formatBurstAmount(amount),
      tone: fpToNumber(amount) < 0 ? "loss" : "gain",
    });
  }
  return bursts;
}
