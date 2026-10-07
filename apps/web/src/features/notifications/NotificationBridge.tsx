import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect } from "react";
import { planNotification } from "@/features/notifications/notificationRules";
import { getNotificationSettings } from "@/features/notifications/notificationSettings";
import { browserNotifier, type Notifier } from "@/features/notifications/notifier";
import { worldEventsStartingOnRoutes } from "@/features/notifications/worldEventAlerts";
import i18n from "@/i18n";
import { subscribeToNewTimelineEvents } from "@/shared/lib/timelineEvents";

/** Most notifications raised for one batch of new events. */
const MAX_PER_BATCH = 3;
const ICON = "/icons/icon-192.png";

/**
 * System notifications for important events while the app is out of view
 * (S34; D3: local first). In view, the timeline toasts already show them.
 * Catch-ups after an absence are skipped: the away report covers them.
 */
export function NotificationBridge({ notifier = browserNotifier }: { notifier?: Notifier }) {
  useEffect(
    () =>
      subscribeToNewTimelineEvents(
        { airline: useAirlineStore, engine: useEngineStore },
        MAX_PER_BATCH,
        (events) => {
          if (notifier.permission() !== "granted" || !notifier.hidden()) return;
          const settings = getNotificationSettings();
          for (const event of [...events].reverse()) {
            const plan = planNotification(event, settings);
            if (!plan) continue;
            notifier
              .show(i18n.t(`notifications.${plan.category}Title`, { ns: "game" }), {
                body: plan.body,
                tag: plan.tag,
                icon: ICON,
                badge: ICON,
              })
              .catch((error: unknown) => console.warn("[notifications] show failed", error));
          }
        },
      ),
    [notifier],
  );

  // A world event starting on one of the player's routes (S55.4). Read from
  // the deterministic schedule as the engine clock moves; each event at most
  // once per visit.
  useEffect(() => {
    let lastTick = useEngineStore.getState().tick;
    const notified = new Set<string>();
    return useEngineStore.subscribe((state) => {
      const tick = state.tick;
      if (tick === lastTick) return;
      const from = lastTick;
      lastTick = tick;
      if (tick < from || notifier.permission() !== "granted" || !notifier.hidden()) return;
      const settings = getNotificationSettings();
      if (!settings.enabled || !settings.categories.worldEvents) return;
      const alerts = worldEventsStartingOnRoutes(from, tick, useAirlineStore.getState().routes);
      for (const { event, routes } of alerts) {
        if (notified.has(event.id)) continue;
        notified.add(event.id);
        notifier
          .show(i18n.t("notifications.worldEventsTitle", { ns: "game" }), {
            body: i18n.t("notifications.worldEventBody", {
              ns: "game",
              kind: i18n.t(`worldEvents.kinds.${event.kind}`, { ns: "game" }),
              airport: event.airportIata,
              routes: routes.join(", "),
            }),
            tag: `acars-worldEvents-${event.id}`,
            icon: ICON,
            badge: ICON,
          })
          .catch((error: unknown) => console.warn("[notifications] show failed", error));
      }
    });
  }, [notifier]);
  return null;
}
