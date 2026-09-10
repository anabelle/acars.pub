import type { TimelineEvent, TimelineEventType } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import React from "react";
import { toast } from "sonner";
import i18n from "@/i18n";

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
  price_war: "timeline.events.priceWar",
  tier_upgrade: "timeline.events.tierUpgrade",
  bankruptcy: "timeline.events.bankruptcy",
  financial_warning: "timeline.events.financialWarning",
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
  price_war: "warning",
  tier_upgrade: "success",
  bankruptcy: "warning",
  financial_warning: "warning",
};

const showTimelineToast = (event: TimelineEvent) => {
  const title = resolveEventTitle(event.type);
  const description = event.description;
  const kind = EVENT_TOAST_KIND[event.type] ?? "info";

  if (event.type === "bankruptcy") {
    toast.error(`${title} ⚠️`, { description, duration: 15000 });
    return;
  }
  if (kind === "success") {
    toast.success(title, { description, duration: 4000 });
    return;
  }
  if (kind === "warning") {
    toast.warning(title, { description, duration: 6000 });
    return;
  }
  toast.info(title, { description, duration: 4000 });
};

export const TimelineToastBridge = (): null => {
  const lastEventIdRef = React.useRef<string | null>(null);
  const isCatchupRef = React.useRef(false);

  React.useEffect(() => {
    lastEventIdRef.current = useAirlineStore.getState().timeline[0]?.id ?? null;
    isCatchupRef.current = !!useEngineStore.getState().catchupProgress;

    const unsubscribeCatchup = useEngineStore.subscribe((state) => {
      isCatchupRef.current = !!state.catchupProgress;
    });

    const unsubscribeTimeline = useAirlineStore.subscribe((state, prevState) => {
      const timeline = state.timeline;
      const previousTimeline = prevState.timeline;
      if (timeline === previousTimeline) return;

      if (!timeline.length) {
        lastEventIdRef.current = null;
        return;
      }

      if (isCatchupRef.current) {
        lastEventIdRef.current = timeline[0]?.id ?? null;
        return;
      }

      const latestId = timeline[0]?.id ?? null;
      if (!latestId || latestId === lastEventIdRef.current) return;

      const lastSeenId = lastEventIdRef.current;
      let newEvents: TimelineEvent[] = [];
      if (!lastSeenId) {
        newEvents = [timeline[0]];
      } else {
        const lastIndex = timeline.findIndex((event) => event.id === lastSeenId);
        newEvents =
          lastIndex === -1 ? timeline.slice(0, MAX_TOASTS_PER_BATCH) : timeline.slice(0, lastIndex);
      }

      lastEventIdRef.current = latestId;

      if (!newEvents.length) return;
      const limitedEvents = newEvents.slice(0, MAX_TOASTS_PER_BATCH).reverse();
      for (const event of limitedEvents) {
        showTimelineToast(event);
      }
    });

    return () => {
      unsubscribeCatchup();
      unsubscribeTimeline();
    };
  }, []);

  return null;
};
