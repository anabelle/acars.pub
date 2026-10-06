import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect } from "react";
import i18n from "@/i18n";
import { planNotification } from "@/features/notifications/notificationRules";
import { browserNotifier, type Notifier } from "@/features/notifications/notifier";
import { getNotificationSettings } from "@/features/notifications/notificationSettings";
import { subscribeToNewTimelineEvents } from "@/shared/lib/timelineEvents";

/** Most notifications raised for one batch of new events. */
const MAX_PER_BATCH = 3;

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
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
              })
              .catch((error: unknown) => console.warn("[notifications] show failed", error));
          }
        },
      ),
    [notifier],
  );
  return null;
}
