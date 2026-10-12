import { cancelRankMining, getRanked, useAirlineStore, useRankStore } from "@acars/store";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Get ranked (S72, D15 "computer work first"): a few seconds of proof of work,
 * once. Ranked airlines appear in the ranking and can price freely against
 * rivals; unranked ones can't undercut the suggested fare.
 */
export function GetRanked() {
  const { t } = useTranslation("game");
  const pubkey = useAirlineStore((s) => s.pubkey);
  const airline = useAirlineStore((s) => s.airline);
  const status = useRankStore((s) => s.status);
  const hashes = useRankStore((s) => s.hashes);
  if (!pubkey || !airline || status === "unknown") return null;

  if (status === "ranked") {
    return (
      <p
        data-testid="get-ranked"
        data-status="ranked"
        className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {t("rank.ranked")}
      </p>
    );
  }

  const busy = status === "mining" || status === "publishing";
  return (
    <div
      data-testid="get-ranked"
      data-status={status}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
    >
      <p className="font-semibold text-foreground">{t("rank.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("rank.why")}</p>
      {status === "failed" ? (
        <p className="mt-1 text-xs text-rose-300">{t("rank.failed")}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {busy ? (
          <>
            <span className="text-xs tabular-nums text-amber-300" aria-live="polite">
              {status === "publishing"
                ? t("rank.publishing")
                : t("rank.mining", { count: hashes, tries: hashes.toLocaleString() })}
            </span>
            {status === "mining" ? (
              <button
                type="button"
                onClick={() => cancelRankMining()}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold"
              >
                {t("rank.cancel")}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => void getRanked(pubkey)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            {t("rank.start")}
          </button>
        )}
      </div>
    </div>
  );
}
