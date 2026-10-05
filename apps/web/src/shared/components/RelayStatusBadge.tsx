import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRelayHealth } from "@/shared/hooks/useRelayHealth";

/** Real relay connection state (S21): connecting, connected (with count), or offline with retry. */
export function RelayStatusBadge() {
  const { t } = useTranslation(["common"]);
  const { status, relayCount, retry, retrying } = useRelayHealth();

  if (status === "ready") {
    return (
      <span
        data-testid="relay-status"
        data-status="ready"
        className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        {t("relay.ready", { count: relayCount })}
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span
        data-testid="relay-status"
        data-status="connecting"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {t("relay.connecting")}
      </span>
    );
  }

  return (
    <span
      data-testid="relay-status"
      data-status="offline"
      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200"
    >
      <WifiOff className="h-3 w-3" aria-hidden="true" />
      {t("relay.offline")}
      <button
        type="button"
        onClick={() => void retry()}
        disabled={retrying}
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 normal-case tracking-normal hover:bg-amber-500/20 disabled:opacity-60"
      >
        <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} aria-hidden="true" />
        {t("relay.retry")}
      </button>
    </span>
  );
}
