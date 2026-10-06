export type PermissionState = NotificationPermission | "unsupported";

export interface PermissionApi {
  current: () => PermissionState;
  request: () => Promise<PermissionState>;
}

/** The browser's Notification permission ("unsupported" without the API). */
export const browserPermission: PermissionApi = {
  current: () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  request: async () =>
    typeof Notification === "undefined" ? "unsupported" : Notification.requestPermission(),
};
