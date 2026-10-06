import { useSyncExternalStore } from "react";
import {
  loadNotificationSettings,
  type NotificationSettings,
  saveNotificationSettings,
} from "@/features/notifications/notificationRules";

/** Per-device notification settings, persisted in localStorage (S34). */

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

let current: NotificationSettings | null = null;
const listeners = new Set<() => void>();

export function getNotificationSettings(): NotificationSettings {
  current ??= loadNotificationSettings(storage());
  return current;
}

export function setNotificationSettings(
  update: NotificationSettings | ((settings: NotificationSettings) => NotificationSettings),
): void {
  const next = typeof update === "function" ? update(getNotificationSettings()) : update;
  current = next;
  saveNotificationSettings(storage(), next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotificationSettings(): NotificationSettings {
  return useSyncExternalStore(subscribe, getNotificationSettings, getNotificationSettings);
}

/** Forget the in-memory copy (tests). */
export function resetNotificationSettingsCache(): void {
  current = null;
}
