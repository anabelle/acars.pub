import { cn } from "@/shared/lib/utils";
import { clipDay } from "./day";

export interface DayLeg {
  /** UTC hour the leg departs, 0–24 (fractions allowed). */
  startHour: number;
  durationHours: number;
}

type Props = {
  legs: readonly DayLeg[];
  /** Leg colour; defaults to the active-leg magenta. Pass an airline's livery colour. */
  colour?: string;
  /** Screen-reader summary; defaults to the block hours. */
  label?: string;
  className?: string;
};

/** A plane's day as a 24-hour strip of legs (S59): the rhythm at a glance. */
export function DayStrip({ legs, colour = "rgb(var(--nd-magenta))", label, className }: Props) {
  const day = clipDay(legs);
  return (
    <div
      role="img"
      aria-label={label ?? `${day.blockHours.toFixed(1)} block hours today`}
      className={cn("relative h-2.5 rounded-[2px] bg-black/25", className)}
    >
      {day.legs.map((leg) => (
        <span
          key={`${leg.startHour}-${leg.durationHours}`}
          data-testid="day-leg"
          className="absolute inset-y-0 rounded-[2px]"
          style={{
            left: `${(leg.startHour / 24) * 100}%`,
            width: `${(leg.durationHours / 24) * 100}%`,
            background: colour,
          }}
        />
      ))}
    </div>
  );
}
