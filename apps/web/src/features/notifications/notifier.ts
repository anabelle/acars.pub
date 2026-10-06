export interface Notifier {
  /** "granted" | "denied" | "default", or "unsupported". */
  permission: () => NotificationPermission | "unsupported";
  /** Whether the app is out of view (a hidden tab or a minimised app). */
  hidden: () => boolean;
  show: (title: string, options: NotificationOptions) => Promise<void>;
}

/** Browser notifier: through the service worker when there is one (needed on Android). */
export const browserNotifier: Notifier = {
  permission: () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  hidden: () => document.visibilityState !== "visible",
  show: async (title, options) => {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  },
};
