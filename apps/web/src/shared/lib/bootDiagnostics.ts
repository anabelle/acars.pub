import { bootMark } from "@acars/store";

/**
 * Startup diagnostics (`?boot=1`): long main-thread tasks since page start,
 * so a slow boot shows whether the page was busy (CPU) or waiting (network).
 */
export interface LongTaskSummary {
  count: number;
  totalMs: number;
  longestMs: number;
  /** When the longest task started, ms since page start. */
  longestAt: number;
}

const summary: LongTaskSummary = { count: 0, totalMs: 0, longestMs: 0, longestAt: 0 };

export function recordLongTask(summaryRef: LongTaskSummary, start: number, duration: number): void {
  summaryRef.count++;
  summaryRef.totalMs += duration;
  if (duration > summaryRef.longestMs) {
    summaryRef.longestMs = duration;
    summaryRef.longestAt = start;
  }
}

/** Starts counting long tasks (where the browser supports it). Safe to call once at startup. */
export function startBootDiagnostics(): void {
  bootMark("app: script started");
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        recordLongTask(summary, entry.startTime, entry.duration);
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // No long-task support (Safari, older browsers): the stage marks still work.
  }
}

export function getLongTaskSummary(): LongTaskSummary {
  return { ...summary };
}

const BOOT_FLAG_KEY = "acars_boot_trace";

/** True when `?boot=1` is in the URL (remembered for the tab) or was set earlier this session. */
export function isBootTraceRequested(
  search: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null,
): boolean {
  const value = new URLSearchParams(search).get("boot");
  try {
    if (value === "1") storage?.setItem(BOOT_FLAG_KEY, "1");
    if (value === "0") storage?.setItem(BOOT_FLAG_KEY, "0");
    return value === "1" || (value !== "0" && storage?.getItem(BOOT_FLAG_KEY) === "1");
  } catch {
    return value === "1";
  }
}
