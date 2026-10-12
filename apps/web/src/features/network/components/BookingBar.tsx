/**
 * How full a flight is, at a glance (S63): a bar and the percentage — green
 * when it fills well, amber when it is (nearly) sold out, grey when thin.
 */
export function BookingBar({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-right text-[10px] text-slate-500">--</span>;
  }
  const tone = percent >= 95 ? "bg-nd-amber" : percent >= 60 ? "bg-nd-green" : "bg-slate-500";
  return (
    <span
      data-testid="booking-bar"
      role="img"
      aria-label={`${percent}%`}
      className="flex flex-col items-end gap-0.5"
    >
      <span className="text-[10px] tabular-nums text-slate-200">{percent}%</span>
      <span className="h-1 w-full overflow-hidden rounded-[1px] bg-slate-700">
        <span className={`block h-full ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </span>
    </span>
  );
}
