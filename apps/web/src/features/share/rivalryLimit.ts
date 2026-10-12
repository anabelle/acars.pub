/**
 * Rivalry notes are rate-limited (S74, D18): at most this many a UTC day
 * from one browser. A convenience against spam, not a security boundary.
 */
export const RIVALRY_POSTS_PER_DAY = 3;
const KEY = "acars_rivalry_posts";

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function read(now: number): number {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      day?: string;
      count?: number;
    } | null;
    return saved?.day === today(now) && typeof saved.count === "number" ? saved.count : 0;
  } catch {
    return 0;
  }
}

/** Rivalry notes still allowed today. */
export function rivalryPostsLeft(now = Date.now()): number {
  return Math.max(0, RIVALRY_POSTS_PER_DAY - read(now));
}

/** Count one rivalry note posted now. */
export function recordRivalryPost(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today(now), count: read(now) + 1 }));
  } catch {
    // Storage blocked: the limit simply can't be kept in this browser.
  }
}
