import type { TimelineEvent, TimelineEventType } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import React from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import { subscribeToNewTimelineEvents } from "@/shared/lib/timelineEvents";

const MAX_TOASTS_PER_BATCH = 5;

// Titles resolve through i18n at toast time — this bridge toasts from store
// subscriptions outside React render, so we use the i18n instance directly.
const EVENT_TITLE_KEYS: Record<TimelineEventType, string> = {
  takeoff: "timeline.events.takeoff",
  landing: "timeline.events.landing",
  purchase: "timeline.events.purchase",
  sale: "timeline.events.sale",
  lease_payment: "timeline.events.leasePayment",
  maintenance: "timeline.events.maintenance",
  delivery: "timeline.events.delivery",
  hub_change: "timeline.events.hubChange",
  route_change: "timeline.events.routeChange",
  ferry: "timeline.events.ferry",
  competitor_hub: "timeline.events.competitorHub",
  competitor_route: "timeline.events.competitorRoute",
  price_war: "timeline.events.priceWar",
  tier_upgrade: "timeline.events.tierUpgrade",
  bankruptcy: "timeline.events.bankruptcy",
  financial_warning: "timeline.events.financialWarning",
  objective_reward: "timeline.events.objectiveReward",
};

const resolveEventTitle = (type: TimelineEventType): string =>
  i18n.t(EVENT_TITLE_KEYS[type] ?? "timeline.events.operationsUpdate", { ns: "game" });

const EVENT_TOAST_KIND: Record<TimelineEventType, "success" | "info" | "warning"> = {
  takeoff: "info",
  landing: "success",
  purchase: "success",
  sale: "success",
  lease_payment: "warning",
  maintenance: "warning",
  delivery: "success",
  hub_change: "info",
  route_change: "info",
  ferry: "info",
  competitor_hub: "warning",
  competitor_route: "warning",
  price_war: "warning",
  tier_upgrade: "success",
  bankruptcy: "warning",
  financial_warning: "warning",
  objective_reward: "success",
};

/**
 * Events the player causes with a button that answers with its own toast
 * (launch a route, buy a plane...). Their timeline toast waits a moment and is
 * dropped if the screen already said it, so one click doesn't stack 3 toasts.
 */
const OWN_ACTION_TYPES = new Set<TimelineEventType>([
  "purchase",
  "sale",
  "route_change",
  "hub_change",
]);
export const OWN_ACTION_ECHO_MS = 1_500;
const bridgeToastIds = new Set<string | number>();

const showTimelineToast = (event: TimelineEvent) => {
  const id = showToast(event);
  if (id !== undefined) bridgeToastIds.add(id);
};

const toastIds = () => new Set(toast.getHistory().map((shown) => shown.id));

const showOwnActionToast = (event: TimelineEvent) => {
  const before = toastIds();
  setTimeout(() => {
    const echoed = [...toastIds()].some((id) => !before.has(id) && !bridgeToastIds.has(id));
    if (!echoed) showTimelineToast(event);
  }, OWN_ACTION_ECHO_MS);
};

const showToast = (event: TimelineEvent): string | number | undefined => {
  const title = resolveEventTitle(event.type);
  const description = event.description;
  const kind = EVENT_TOAST_KIND[event.type] ?? "info";

  if (event.type === "bankruptcy") {
    return toast.error(`${title} ⚠️`, { description, duration: 15000 });
  }
  if (kind === "success") {
    return toast.success(title, { description, duration: 4000 });
  }
  if (kind === "warning") {
    return toast.warning(title, { description, duration: 6000 });
  }
  return toast.info(title, { description, duration: 4000 });
};

export const TimelineToastBridge = (): null => {
  // Long catch-ups (an absence of an hour or more, or loading the airline)
  // are summarized by the away report instead of a burst of stale toasts.
  React.useEffect(
    () =>
      subscribeToNewTimelineEvents(
        { airline: useAirlineStore, engine: useEngineStore },
        MAX_TOASTS_PER_BATCH,
        (events) => {
          for (const event of [...events].reverse()) {
            if (OWN_ACTION_TYPES.has(event.type)) showOwnActionToast(event);
            else showTimelineToast(event);
          }
        },
      ),
    [],
  );

  return null;
};
