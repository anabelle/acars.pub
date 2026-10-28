import type { AircraftInstance } from "@acars/core";
import { fpRaw } from "@acars/core";
import type { ActionLogEntry } from "@acars/nostr";

/**
 * Seller-side sale proof (security fix for unbound peer aircraft claims).
 *
 * A competitor snapshot that lists one of our aircraft in its fleet is only
 * a *claim*. Snapshots are publisher-authored state, so anyone can claim any
 * publicly listed instanceId at the public asking price. A sale settles only
 * when the claimant also signed an `AIRCRAFT_BUY_USED` action for that exact
 * aircraft at our listing price, issued no earlier than our own acquisition
 * of it (so an old purchase of the same instance cannot be replayed against
 * a later owner's listing).
 */

export interface ProvenSale {
  aircraftId: string;
  buyerPubkey: string;
  eventId: string;
}

/** Max raw fixed-point delta tolerated between listing and buy price. */
const PRICE_TOLERANCE = fpRaw(1) as number;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Pick, for each listed aircraft, the earliest buyer-signed purchase that
 * proves a claim. Pure: callers supply the claimants (from competitor
 * snapshots) and the claimants' action entries (signature-verified by NDK).
 */
export function selectProvenSales(
  listed: readonly AircraftInstance[],
  claimantsByAircraft: ReadonlyMap<string, ReadonlySet<string>>,
  buyActions: readonly ActionLogEntry[],
): ProvenSale[] {
  const listedById = new Map<string, AircraftInstance>();
  for (const ac of listed) {
    if (ac.listingPrice != null && (ac.listingPrice as number) > 0) listedById.set(ac.id, ac);
  }

  const best = new Map<string, { sale: ProvenSale; createdAt: number }>();
  for (const entry of buyActions) {
    if (entry.action?.action !== "AIRCRAFT_BUY_USED") continue;
    const payload = entry.action.payload as Record<string, unknown> | undefined;
    const instanceId = payload?.instanceId;
    if (typeof instanceId !== "string") continue;
    const aircraft = listedById.get(instanceId);
    if (!aircraft) continue;

    const buyer = entry.event?.author?.pubkey;
    if (typeof buyer !== "string" || !claimantsByAircraft.get(instanceId)?.has(buyer)) continue;

    const price = asFiniteNumber(payload?.price);
    if (price === null) continue;
    if (Math.abs(price - (aircraft.listingPrice as number)) > PRICE_TOLERANCE) continue;

    const tick = asFiniteNumber(payload?.tick);
    if (tick === null || tick < (aircraft.purchasedAtTick ?? 0)) continue;

    const eventId = entry.event.id;
    const createdAt = entry.event.created_at ?? 0;
    const current = best.get(instanceId);
    if (
      !current ||
      createdAt < current.createdAt ||
      (createdAt === current.createdAt && eventId.localeCompare(current.sale.eventId) < 0)
    ) {
      best.set(instanceId, {
        sale: { aircraftId: instanceId, buyerPubkey: buyer, eventId },
        createdAt,
      });
    }
  }
  return [...best.values()].map((b) => b.sale);
}

/** Don't re-query the same unproven claim more often than this. */
export const UNPROVEN_CLAIM_RECHECK_MS = 5 * 60_000;
