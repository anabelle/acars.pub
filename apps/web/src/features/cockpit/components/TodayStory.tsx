import type { AirlineEntity } from "@acars/core";
import { fpFormat } from "@acars/core";
import { getAircraftById } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AircraftLiveryImage } from "@/features/fleet/components/AircraftLiveryImage";
import { LiveryFallback } from "@/features/fleet/components/LiveryFallback";
import { formatUtcClock, tickToUtcMs } from "@/features/network/utils/tickerFacts";
import { navigateToAircraft } from "@/shared/lib/permalinkNavigation";
import { PaxCrowd, Sign, Slab } from "@/shared/ui/ramp";
import type { Chapter, TodayStory as Story } from "../utils/todayStory";

const signButton =
  "min-h-10 self-start rounded-[3px] bg-sign-yellow px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black";

/**
 * The check-in story (S62): the last 24 hours told like a short logbook
 * entry on the ramp — a date sign, what was earned and flown, then chapters
 * on a magenta line, ending with what needs the player now.
 */
export function TodayStory({ story, tick }: { story: Story; tick: number }) {
  const { t, i18n } = useTranslation("game");
  const date = new Date(tickToUtcMs(tick)).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return (
    <section
      data-testid="today-story"
      aria-labelledby="today-title"
      className="ramp-ground flex flex-col gap-4 rounded-[3px] p-4 text-ramp-paint sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-title">
          <Sign variant="location">{t("today.title", { date })}</Sign>
        </h2>
        <span className="font-mono text-xs text-ramp-paint/75">{formatUtcClock(tick)}Z</span>
      </div>
      <p
        data-testid="today-summary"
        className="flex flex-wrap gap-x-4 gap-y-1 border-b border-ramp-paint/15 pb-3 font-mono text-sm"
      >
        <span>
          <b className={story.earned >= 0 ? "text-nd-green" : "text-nd-red"}>
            {story.earned >= 0 ? "+" : ""}
            {fpFormat(story.earned, 0)}
          </b>{" "}
          {t("today.earned")}
        </span>
        <span>{t("today.flown", { count: story.passengers })}</span>
        <span>{t("today.landings", { count: story.landings })}</span>
        {story.onTime ? (
          <span data-testid="today-on-time">
            {t("today.onTime", { pct: Math.round(story.onTime.rate * 100) })}
          </span>
        ) : null}
      </p>
      {story.chapters.length === 0 ? (
        <p className="text-sm text-ramp-paint/80">{t("today.quiet")}</p>
      ) : (
        <ol className="relative flex flex-col gap-4">
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[5px] top-2 w-0.5 bg-nd-magenta/80"
          />
          {story.chapters.map((chapter) => (
            <li
              key={`${chapter.kind}-${chapter.tick}`}
              data-testid={`chapter-${chapter.kind}`}
              className="relative flex flex-col gap-1.5 pl-6"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 h-3 w-3 rounded-full bg-ramp-asphalt ring-2 ring-ramp-paint"
              />
              <ChapterBody chapter={chapter} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ChapterBody({ chapter }: { chapter: Chapter }) {
  const { t } = useTranslation("game");
  const navigate = useNavigate();
  const airline = useAirlineStore((s) => s.airline);
  const aircraft = useAirlineStore((s) =>
    "aircraftId" in chapter ? s.fleet.find((a) => a.id === chapter.aircraftId) : undefined,
  );
  const when = (label: string) => (
    <span className="font-mono text-[11px] text-ramp-paint/70">
      {chapter.kind === "parked" ? t("today.now") : `${formatUtcClock(chapter.tick)}Z`} · {label}
    </span>
  );

  switch (chapter.kind) {
    case "delivery":
      return (
        <>
          {when(t("today.delivery"))}
          <Slab className="flex items-center gap-3 p-2">
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[2px]">
              <Painting aircraftId={chapter.aircraftId} airline={airline} />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-sign text-lg font-extrabold uppercase tracking-[0.06em]">
                {chapter.name}
              </span>
              <span className="text-xs text-ramp-paint/80">
                {t("today.deliveredAt", { airport: chapter.airport })}
              </span>
            </div>
          </Slab>
        </>
      );
    case "bestFlight":
      return (
        <>
          {when(t("today.bestFlight"))}
          <span className="text-sm leading-relaxed">
            {t("today.bestFlightText", {
              name: chapter.name,
              count: chapter.passengers,
              origin: chapter.origin,
              destination: chapter.destination,
              profit: fpFormat(chapter.profit, 0),
            })}
          </span>
        </>
      );
    case "turnedAway":
      return (
        <>
          {when(`${chapter.origin}–${chapter.destination}`)}
          <Slab edge="idle" className="flex flex-col gap-2.5 p-3">
            <span className="text-sm leading-relaxed">
              {t("today.turnedAwayText", {
                destination: chapter.destination,
                count: chapter.turnedAway,
              })}
            </span>
            <PaxCrowd
              segments={[
                { count: chapter.boarded, tone: "paint", label: t("today.boarded") },
                { count: chapter.turnedAway, tone: "caution", label: t("today.stayedBehind") },
              ]}
            />
            <button
              type="button"
              className={signButton}
              onClick={() => navigate({ to: "/network", search: { tab: "active" } as never })}
            >
              {t("today.addCapacity")} ▶
            </button>
          </Slab>
        </>
      );
    case "parked":
      return (
        <>
          {when(t("today.needsYou"))}
          <Slab edge="idle" className="flex flex-col gap-2.5 p-3">
            <span className="text-sm leading-relaxed">
              {t("today.parkedText", { name: chapter.name, airport: chapter.airport })}
              {chapter.others > 0 ? t("today.parkedMore", { count: chapter.others }) : ""}
            </span>
            <button
              type="button"
              className={signButton}
              onClick={() => navigateToAircraft(chapter.aircraftId)}
            >
              {t("today.putToWork", { name: aircraft?.name ?? chapter.name })} ▶
            </button>
          </Slab>
        </>
      );
  }
}

function Painting({ aircraftId, airline }: { aircraftId: string; airline: AirlineEntity | null }) {
  const aircraft = useAirlineStore((s) => s.fleet.find((a) => a.id === aircraftId));
  const model = aircraft ? getAircraftById(aircraft.modelId) : undefined;
  if (!aircraft || !model)
    return <LiveryFallback familyId="a320" primary={airline?.livery?.primary} />;
  return (
    <AircraftLiveryImage
      aircraft={aircraft}
      airline={airline}
      model={model}
      isOwner
      fallback={
        <LiveryFallback
          familyId={model.familyId}
          primary={airline?.livery?.primary}
          secondary={airline?.livery?.secondary}
        />
      }
    />
  );
}
