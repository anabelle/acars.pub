import {
  type DailyObjective,
  fpFormat,
  type ObjectiveAirportLookup,
  type ObjectiveLedger,
  TICKS_PER_HOUR,
} from "@acars/core";
import { getAirports, isDataCatalogReady } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { CheckCircle2, Circle, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { deriveObjectiveBoard, type ObjectiveBoardItem } from "../utils/dailyObjectives";

const TICKS_PER_MINUTE = TICKS_PER_HOUR / 60;

/** The objective's sentence, e.g. "Open a route of at least 3,000 km". */
function useObjectiveTitle() {
  const { t, i18n } = useTranslation("game");
  return (objective: DailyObjective) => {
    const base = "cockpit.objectives.kinds";
    switch (objective.kind) {
      case "openRoute":
        return objective.minDistanceKm
          ? t(`${base}.openRouteMin`, {
              km: new Intl.NumberFormat(i18n.language).format(objective.minDistanceKm),
            })
          : t(`${base}.openRoute`);
      case "openRouteToTag":
        return t(`${base}.openRouteToTag`, {
          tag: t(`cockpit.objectives.tags.${objective.tag ?? "business"}`),
        });
      case "routeToEvent":
        return t(`${base}.routeToEvent`, {
          event: t(`worldEvents.kinds.${objective.eventKind ?? "festival"}`),
          airport: objective.airportIata ?? "",
        });
      case "assignAircraft":
      case "serviceAircraft":
        return t(`${base}.${objective.kind}`, { count: objective.target });
      default:
        return t(`${base}.${objective.kind}`);
    }
  };
}

function ObjectiveRow({
  item,
  claiming,
  onClaim,
}: {
  item: ObjectiveBoardItem;
  claiming: boolean;
  onClaim: (id: string) => void;
}) {
  const { t } = useTranslation("game");
  const title = useObjectiveTitle();
  const { objective, progress, complete, claimed } = item;
  return (
    <li
      data-testid={`objective-${objective.kind}`}
      data-complete={complete}
      data-claimed={claimed}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
        complete && !claimed ? "border-primary/40 bg-background/80" : "border-transparent",
      )}
    >
      {complete ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title(objective)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("cockpit.objectives.progress", { done: progress, target: objective.target })}
          {" · "}
          <span className="font-semibold text-emerald-400">
            {t("cockpit.objectives.reward", { amount: fpFormat(objective.reward, 0) })}
          </span>
        </p>
      </div>
      {claimed ? (
        <span className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {t("cockpit.objectives.claimed")}
        </span>
      ) : complete ? (
        <button
          type="button"
          disabled={claiming}
          onClick={() => onClaim(objective.id)}
          className="inline-flex shrink-0 items-center rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {claiming ? t("cockpit.objectives.claiming") : t("cockpit.objectives.claim")}
        </button>
      ) : null}
    </li>
  );
}

/**
 * Daily objectives (S32.4): three goals a day, the same for every player.
 * Progress comes from the airline's replayed ledger; claiming publishes a
 * CLAIM_OBJECTIVE that every client verifies the same way (D6).
 */
export function DailyObjectivesCard({ ledger }: { ledger: ObjectiveLedger | undefined }) {
  const { t } = useTranslation("game");
  const tick = useEngineStore((state) => state.tick);
  const claimObjective = useAirlineStore((state) => state.claimObjective);
  const [pending, setPending] = useState<string | null>(null);
  const catalogReady = isDataCatalogReady();

  const lookup = useMemo<ObjectiveAirportLookup | null>(() => {
    if (!catalogReady) return null;
    const byIata = new Map(getAirports().map((airport) => [airport.iata, airport]));
    return (iata) => byIata.get(iata);
  }, [catalogReady]);

  const board = useMemo(
    () => (lookup ? deriveObjectiveBoard({ tick, ledger, lookup }) : null),
    [tick, ledger, lookup],
  );

  const claim = async (objectiveId: string) => {
    setPending(objectiveId);
    try {
      await claimObjective(objectiveId);
      toast.success(t("cockpit.objectives.claimSuccess"));
    } catch (error) {
      toast.error(t("cockpit.objectives.claimFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPending(null);
    }
  };

  const minutesLeft = board ? Math.ceil(board.ticksLeft / TICKS_PER_MINUTE) : 0;

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm"
      aria-labelledby="daily-objectives-title"
      data-testid="daily-objectives"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t("cockpit.objectives.kicker")}
          </p>
          <h2 id="daily-objectives-title" className="mt-1 text-lg font-black tracking-tight">
            {t("cockpit.objectives.title")}
          </h2>
          {board && (
            <p className="mt-0.5 text-xs text-muted-foreground" data-testid="objectives-reset">
              {t("cockpit.objectives.resetsIn", {
                hours: Math.floor(minutesLeft / 60),
                minutes: minutesLeft % 60,
              })}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-primary">
          <Target className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      {!board ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("cockpit.objectives.loading")}</p>
      ) : (
        <>
          <ol className="mt-4 space-y-2">
            {board.items.map((item) => (
              <ObjectiveRow
                key={item.objective.id}
                item={item}
                claiming={pending === item.objective.id}
                onClaim={claim}
              />
            ))}
          </ol>
          {board.carryover.length > 0 && (
            <div className="mt-4" data-testid="objectives-carryover">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("cockpit.objectives.carryover")}
              </p>
              <ol className="mt-2 space-y-2">
                {board.carryover.map((item) => (
                  <ObjectiveRow
                    key={item.objective.id}
                    item={item}
                    claiming={pending === item.objective.id}
                    onClaim={claim}
                  />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
