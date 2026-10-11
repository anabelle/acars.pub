import type { Page } from "@playwright/test";

/**
 * Visible controls cut off by an overflow-hidden ancestor or by the viewport
 * (S57 audit, permanent since S59). A scrolling ancestor ends the search: a
 * control inside a scroller can always be scrolled into view.
 */
export async function clippedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>(
      "button, a[href], [role=button], input, select",
    );
    for (const el of Array.from(controls)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      let reason = "";
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (["auto", "scroll"].includes(s.overflowX) || ["auto", "scroll"].includes(s.overflowY)) {
          break;
        }
        const pr = p.getBoundingClientRect();
        const clipY = s.overflowY === "hidden" || s.overflowY === "clip";
        const clipX = s.overflowX === "hidden" || s.overflowX === "clip";
        if (clipY && (r.bottom > pr.bottom + 1 || r.top < pr.top - 1)) {
          reason = `clipped vertically by ${p.tagName}.${String(p.className).slice(0, 60)}`;
          break;
        }
        if (clipX && (r.right > pr.right + 1 || r.left < pr.left - 1)) {
          reason = `clipped horizontally by ${p.tagName}.${String(p.className).slice(0, 60)}`;
          break;
        }
      }
      if (!reason && (r.left < -1 || r.right > window.innerWidth + 1)) {
        reason = "outside the viewport";
      }
      if (reason) {
        const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim();
        out.push(`${name.slice(0, 40)} :: ${reason}`);
      }
    }
    return [...new Set(out)];
  });
}

/** The screens a new player visits in the first hour. */
export const AUDITED_SCREENS = [
  "/?panel=cockpit",
  "/fleet",
  "/network",
  "/network?tab=opportunities",
  "/airport/BCN",
  "/finance",
  "/leaderboard",
] as const;
