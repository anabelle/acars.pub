import { cn } from "@/shared/lib/utils";

export type ReadoutTone = "data" | "normal" | "caution" | "warning" | "selected";

const TONES: Record<ReadoutTone, string> = {
  data: "text-nd-white",
  normal: "text-nd-green",
  caution: "text-nd-amber",
  warning: "text-nd-red",
  selected: "text-nd-cyan",
};

type Props = {
  label: string;
  value: string;
  unit?: string;
  tone?: ReadoutTone;
  className?: string;
};

/** A boxed avionics figure (S59): label above, value in a hairline box. */
export function Readout({ label, value, unit, tone = "data", className }: Props) {
  return (
    <div className={cn("inline-flex flex-col gap-1", className)} data-tone={tone}>
      <span className="font-avionics text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-baseline gap-1 rounded-[2px] border border-cockpit-line bg-cockpit-bg px-2 py-1 font-mono text-base font-bold",
          TONES[tone],
        )}
      >
        {value}
        {unit ? (
          <span className="text-[11px] font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </div>
  );
}
