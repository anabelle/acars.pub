import { useTranslation } from "react-i18next";
import { formatUtcClock } from "@/features/network/utils/tickerFacts";
import { navigateToAircraft } from "@/shared/lib/permalinkNavigation";
import { cn } from "@/shared/lib/utils";
import { useAcarsFeed } from "../hooks/useAcarsFeed";
import type { AcarsKind, AcarsMessage } from "../utils/acars";

const KIND_COLOUR: Record<AcarsKind, string> = {
  OUT: "text-nd-white",
  OFF: "text-nd-cyan",
  POS: "text-nd-green",
  ON: "text-nd-cyan",
  IN: "text-nd-white",
};

type Props = {
  messages: readonly AcarsMessage[];
  /** Airline feed: show each message's flight and plane (the name opens it). */
  showPlane?: boolean;
  testId?: string;
  className?: string;
};

/**
 * ACARS messages (S65) printed like a cockpit printer: UTC time, flight,
 * the OOOI or position code coloured by phase, then the terse body.
 */
export function AcarsFeed({ messages, showPlane = false, testId, className }: Props) {
  const { t } = useTranslation("game");
  return (
    <section
      data-testid={testId}
      aria-label={t("acars.title")}
      className={cn("space-y-2", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("acars.title")}
        </h4>
        <span className="text-[10px] text-muted-foreground">{t("acars.subtitle")}</span>
      </div>
      {messages.length === 0 ? (
        <p className="rounded-[3px] border border-cockpit-line bg-cockpit-bg px-2.5 py-2 font-mono text-[11px] uppercase text-muted-foreground">
          {t("acars.empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-1 rounded-[3px] border border-cockpit-line bg-cockpit-bg px-2.5 py-2 font-mono text-[11px] uppercase leading-snug">
          {messages.map((m) => (
            <li
              key={m.id}
              data-testid="acars-message"
              data-kind={m.kind}
              className="flex flex-wrap items-baseline gap-x-2 text-nd-green/90"
            >
              <span className="text-muted-foreground">{formatUtcClock(m.tick)}Z</span>
              {showPlane ? (
                <button
                  type="button"
                  onClick={() => navigateToAircraft(m.aircraftId)}
                  className="text-nd-white underline-offset-2 hover:underline"
                  title={m.aircraftName}
                >
                  {m.flight}
                </button>
              ) : null}
              <span className={cn("w-7 font-bold", KIND_COLOUR[m.kind])}>{m.kind}</span>
              <span className="min-w-0 break-words">{m.body}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** One plane's last messages, for its panel. */
export function PlaneAcars({ aircraftId }: { aircraftId: string }) {
  const messages = useAcarsFeed({ aircraftId, limit: 8 });
  return <AcarsFeed testId="plane-acars" messages={messages} />;
}

/** The airline's latest messages, for the cockpit. */
export function AirlineAcars() {
  const messages = useAcarsFeed({ limit: 12 });
  return <AcarsFeed testId="airline-acars" messages={messages} showPlane />;
}
