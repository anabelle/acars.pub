import { cn } from "@/shared/lib/utils";
import { sortAlerts } from "./alerts";

/** Airliner alert levels, most urgent first. */
export type AlertLevel = "warning" | "caution" | "advisory" | "normal";

export interface CockpitAlert {
  id: string;
  level: AlertLevel;
  /** Short, upper-case-friendly message: "KDFW TSRA · QUETZAL HOLD 18 MIN". */
  text: string;
}

const COLOURS: Record<AlertLevel, string> = {
  warning: "text-nd-red",
  caution: "text-nd-amber",
  advisory: "text-nd-cyan",
  normal: "text-nd-green",
};

type Props = {
  alerts: readonly CockpitAlert[];
  className?: string;
};

/** A short airliner-style message list (S59): one line per alert, colour = level. */
export function AlertList({ alerts, className }: Props) {
  if (alerts.length === 0) return null;
  return (
    <ul
      aria-live="polite"
      className={cn(
        "flex flex-col gap-1 rounded-[3px] border border-cockpit-line bg-cockpit-bg px-2.5 py-2 font-avionics-mono text-[11px] uppercase",
        className,
      )}
    >
      {sortAlerts(alerts).map((alert) => (
        <li key={alert.id} data-level={alert.level} className={COLOURS[alert.level]}>
          {alert.text}
        </li>
      ))}
    </ul>
  );
}
