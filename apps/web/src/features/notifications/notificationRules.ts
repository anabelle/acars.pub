import type { TimelineEvent } from "@acars/core";

/**
 * System notifications (S34, decision D3: local first). Which timeline events
 * notify, in which category, and the per-category settings players choose.
 * A Nostr DM bot for alerts while the app is closed is a later step.
 */

export const NOTIFICATION_CATEGORIES = [
  "grounding",
  "tierUp",
  "rivals",
  "finance",
  "worldEvents",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationSettings {
  /** Master switch; also requires the browser's permission. */
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  categories: { grounding: true, tierUp: true, rivals: true, finance: true, worldEvents: true },
};

export const NOTIFICATION_SETTINGS_KEY = "acars:notifications";

/** Category of an event worth a system notification, or null. */
export function notificationCategory(event: TimelineEvent): NotificationCategory | null {
  switch (event.type) {
    case "maintenance":
      // Only the daily safety alert for a grounded aircraft, not routine checks.
      return event.id.startsWith("evt-grounded-") ? "grounding" : null;
    case "tier_upgrade":
      return "tierUp";
    case "competitor_route":
    case "competitor_hub":
      return "rivals";
    case "bankruptcy":
    case "financial_warning":
      return "finance";
    default:
      return null;
  }
}

export interface PlannedNotification {
  category: NotificationCategory;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag: string;
  body: string;
}

/** The notification an event should raise under `settings`, or null. */
export function planNotification(
  event: TimelineEvent,
  settings: NotificationSettings,
): PlannedNotification | null {
  if (!settings.enabled) return null;
  const category = notificationCategory(event);
  if (!category || !settings.categories[category]) return null;
  // One notification per aircraft / route / category, refreshed rather than piled up.
  const subject =
    event.aircraftId ??
    (event.originIata && event.destinationIata
      ? `${event.originIata}-${event.destinationIata}`
      : category);
  return {
    category,
    tag: `acars-${category}-${subject}`,
    body: event.description.replace(/^\[[A-Z ]+\]\s*/, ""),
  };
}

/** Settings from storage, falling back to defaults for anything missing or invalid. */
export function loadNotificationSettings(
  storage: Pick<Storage, "getItem"> | null,
): NotificationSettings {
  try {
    const raw = storage?.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    const categories = { ...DEFAULT_NOTIFICATION_SETTINGS.categories };
    for (const category of NOTIFICATION_CATEGORIES) {
      const value = parsed.categories?.[category];
      if (typeof value === "boolean") categories[category] = value;
    }
    return { enabled: parsed.enabled === true, categories };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(
  storage: Pick<Storage, "setItem"> | null,
  settings: NotificationSettings,
): void {
  try {
    storage?.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: settings last for this visit
  }
}
