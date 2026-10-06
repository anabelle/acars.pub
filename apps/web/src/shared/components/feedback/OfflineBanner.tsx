import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";

/**
 * Shown while the device is offline (S34): the app keeps running from the
 * last saved state (service-worker shell + local persistence) and queued
 * actions publish once the connection is back.
 */
export function OfflineBanner() {
  const { t } = useTranslation("common");
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[60] flex justify-center px-3"
    >
      <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-1.5 text-xs font-medium text-amber-100 shadow-lg backdrop-blur">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t("offline.banner")}</span>
      </div>
    </div>
  );
}
