import { allianceStatus, MAX_ALLIANCE_PARTNERS } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { Handshake } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Alliance with another airline (S73): propose (name them), accept (name
 * them back), withdraw or leave (drop the name). Allied only when both name
 * each other; then passengers connect across both networks where they meet.
 */
export function AllianceControl({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation("game");
  const me = useAirlineStore((s) => s.pubkey);
  const mine = useAirlineStore((s) => s.airline?.alliancePartners);
  const hasAirline = useAirlineStore((s) => Boolean(s.airline));
  const theirs = useAirlineStore((s) => s.competitors.get(pubkey)?.alliancePartners);
  const setPartners = useAirlineStore((s) => s.setAlliancePartners);
  const [busy, setBusy] = useState(false);
  if (!me || !hasAirline || me === pubkey) return null;

  const status = allianceStatus(mine, theirs, me, pubkey);
  const current = mine ?? [];
  const full = current.length >= MAX_ALLIANCE_PARTNERS && !current.includes(pubkey);
  const update = async (next: string[]) => {
    setBusy(true);
    try {
      await setPartners(next);
    } finally {
      setBusy(false);
    }
  };
  const name = () => update([...current, pubkey]);
  const drop = () => update(current.filter((key) => key !== pubkey));

  return (
    <div
      data-testid="alliance-control"
      data-status={status}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
    >
      <Handshake className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="flex-1 min-w-[12rem] text-xs text-muted-foreground">
        {t(`alliance.status.${status}`)}
      </span>
      {status === "none" || status === "invited" ? (
        <button
          type="button"
          disabled={busy || full}
          onClick={name}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {status === "invited" ? t("alliance.accept") : t("alliance.propose")}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={drop}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          {status === "allied" ? t("alliance.leave") : t("alliance.withdraw")}
        </button>
      )}
      {full ? (
        <span className="w-full text-[11px] text-muted-foreground">
          {t("alliance.full", { count: MAX_ALLIANCE_PARTNERS })}
        </span>
      ) : null}
    </div>
  );
}

/** "Ally" on rivals you are allied with (S73). */
export function AllyBadge({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation("game");
  const allied = useAirlineStore(
    (s) =>
      Boolean(s.pubkey) &&
      allianceStatus(
        s.airline?.alliancePartners,
        s.competitors?.get(pubkey)?.alliancePartners,
        s.pubkey ?? "",
        pubkey,
      ) === "allied",
  );
  if (!allied) return null;
  return (
    <span
      data-testid="ally-badge"
      className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase text-primary"
    >
      {t("alliance.badge")}
    </span>
  );
}
