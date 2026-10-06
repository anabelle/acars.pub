import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NOTIFICATION_CATEGORIES } from "@/features/notifications/notificationRules";
import {
  setNotificationSettings,
  useNotificationSettings,
} from "@/features/notifications/notificationSettings";
import { browserPermission, type PermissionApi } from "@/features/notifications/permission";
import { cn } from "@/shared/lib/utils";

/**
 * "Alerts on this device" (S34): turn system notifications on (asking the
 * browser's permission) and pick the categories. They arrive while the app
 * or installed PWA runs out of view; a Nostr DM bot for alerts while it is
 * closed is planned (D3).
 */
export function NotificationSettingsCard({
  permissionApi = browserPermission,
}: {
  permissionApi?: PermissionApi;
}) {
  const { t } = useTranslation("game");
  const settings = useNotificationSettings();
  const [permission, setPermission] = useState(permissionApi.current);
  const [asking, setAsking] = useState(false);
  const active = settings.enabled && permission === "granted";

  const turnOn = async () => {
    setAsking(true);
    try {
      const result = permission === "granted" ? permission : await permissionApi.request();
      setPermission(result);
      if (result === "granted") setNotificationSettings((s) => ({ ...s, enabled: true }));
    } finally {
      setAsking(false);
    }
  };

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm"
      data-testid="notification-settings"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("notifications.settings.kicker")}
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
            {t("notifications.settings.title")}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {t("notifications.settings.description")}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-primary">
          {active ? (
            <Bell className="h-5 w-5" aria-hidden="true" />
          ) : (
            <BellOff className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
      </div>

      {permission === "unsupported" ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="notifications-unsupported">
          {t("notifications.settings.unsupported")}
        </p>
      ) : permission === "denied" ? (
        <p className="mt-4 text-sm text-amber-300" data-testid="notifications-blocked">
          {t("notifications.settings.blocked")}
        </p>
      ) : active ? (
        <div className="mt-4 space-y-3">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">{t("notifications.settings.categoriesLabel")}</legend>
            {NOTIFICATION_CATEGORIES.map((category) => (
              <label
                key={category}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={settings.categories[category]}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setNotificationSettings((s) => ({
                      ...s,
                      categories: { ...s.categories, [category]: checked },
                    }));
                  }}
                  data-testid={`notification-category-${category}`}
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {t(`notifications.settings.categories.${category}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`notifications.settings.categories.${category}Desc`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => setNotificationSettings((s) => ({ ...s, enabled: false }))}
            className="rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            data-testid="notifications-turn-off"
          >
            {t("notifications.settings.turnOff")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          disabled={asking}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground",
            asking && "opacity-60",
          )}
          data-testid="notifications-turn-on"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {t("notifications.settings.turnOn")}
        </button>
      )}
    </section>
  );
}
