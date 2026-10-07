import { useAirlineStore } from "@acars/store";
import { KeyRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BackupPromptMoment,
  browserBackupPromptStorage,
  dueBackupPrompt,
  markBackupPromptShown,
} from "../lib/backupPrompt";
import {
  isEphemeralKeySecured,
  subscribeEphemeralKeySecurityChanges,
} from "../lib/ephemeralBackup";
import { EphemeralKeyBackupActions } from "./EphemeralKeyBackupActions";

/**
 * "Keep your airline" card for guests (S26.3), shown once after the first
 * landing and once on the first return visit (see `backupPrompt.ts`). It is
 * a floating card, not a modal, so it never stacks on the away report; the
 * banner stays as the standing reminder.
 */
export function KeyBackupPrompt() {
  const { t } = useTranslation("identity");
  const pubkey = useAirlineStore((state) => state.pubkey);
  // Revenue only accrues on landings, so this is "has flown its first flight". O(1).
  const hasLanded = useAirlineStore((state) => Number(state.airline?.cumulativeRevenue ?? 0) > 0);
  // Decided once per account after it has flown (React's "adjust state when
  // inputs change" pattern), so the prompt never jumps to another account's.
  const subject = pubkey && hasLanded ? pubkey : null;
  const [decision, setDecision] = useState<{
    subject: string | null;
    moment: BackupPromptMoment | null;
  }>({ subject: null, moment: null });
  if (decision.subject !== subject) {
    const storage = browserBackupPromptStorage();
    const moment =
      subject && storage
        ? dueBackupPrompt(subject, { hasLanded, secured: isEphemeralKeySecured(subject) }, storage)
        : null;
    setDecision({ subject, moment });
  }
  const moment = decision.subject === subject ? decision.moment : null;
  const close = () => setDecision((current) => ({ ...current, moment: null }));

  // Recorded once it's on screen (idempotent, so a double effect run is harmless).
  useEffect(() => {
    const storage = browserBackupPromptStorage();
    if (decision.subject && decision.moment && storage) {
      markBackupPromptShown(decision.subject, decision.moment, storage);
    }
  }, [decision]);

  useEffect(
    () =>
      subscribeEphemeralKeySecurityChanges((securedPubkey) => {
        if (securedPubkey === pubkey) setDecision((current) => ({ ...current, moment: null }));
      }),
    [pubkey],
  );

  if (!moment) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="key-backup-prompt-title"
      data-testid="key-backup-prompt"
      data-moment={moment}
      className="pointer-events-auto fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] rounded-2xl border border-amber-500/40 bg-amber-950/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-12 sm:right-4 sm:w-96"
    >
      <button
        type="button"
        onClick={close}
        aria-label={t("backupPrompt.close")}
        className="absolute right-2 top-2 rounded-full p-1.5 text-amber-400/70 transition hover:text-amber-200"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="key-backup-prompt-title" className="text-sm font-black text-amber-100">
            {t(moment === "landing" ? "backupPrompt.landingTitle" : "backupPrompt.returnTitle")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
            {t(moment === "landing" ? "backupPrompt.landingBody" : "backupPrompt.returnBody")}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <EphemeralKeyBackupActions showUpgradeButton={false} />
      </div>
      <button
        type="button"
        onClick={close}
        className="mt-3 text-[11px] font-semibold text-amber-300/80 underline-offset-2 hover:underline"
      >
        {t("backupPrompt.later")}
      </button>
    </section>
  );
}
