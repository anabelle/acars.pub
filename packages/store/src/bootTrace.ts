/**
 * Startup trace: timestamps for each boot stage, so a slow start on a real
 * device can be pinned to a stage (`?boot=1` shows them on screen). Marks are
 * cheap (an array push) and always on; nothing is sent anywhere.
 */
export interface BootMark {
  name: string;
  /** Milliseconds since the page started (performance.now()). */
  at: number;
  detail?: string;
}

const marks: BootMark[] = [];
// A fresh snapshot per change, so React's useSyncExternalStore sees updates.
let snapshot: readonly BootMark[] = [];
const listeners = new Set<() => void>();
const MAX_MARKS = 200;

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

export function bootMark(name: string, detail?: string): void {
  if (marks.length >= MAX_MARKS) return;
  marks.push({ name, at: Math.round(now()), detail });
  snapshot = [...marks];
  for (const listener of listeners) listener();
}

export function getBootTrace(): readonly BootMark[] {
  return snapshot;
}

export function subscribeBootTrace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Plain-text trace for pasting into a bug report. */
export function formatBootTrace(trace: readonly BootMark[], extra: readonly string[] = []): string {
  const lines = trace.map(
    (mark) =>
      `${(mark.at / 1000).toFixed(2).padStart(7)}s  ${mark.name}${mark.detail ? `  (${mark.detail})` : ""}`,
  );
  return [...lines, ...extra].join("\n");
}

/** Test helper. */
export function resetBootTrace(): void {
  marks.length = 0;
  snapshot = [];
}
