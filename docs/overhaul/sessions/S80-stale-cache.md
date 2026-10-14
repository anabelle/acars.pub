# S80 — The app never sticks on a broken cached file

> **Status:** ☑ merged
> **Next step:** — (merged in #205; affected browsers heal on their next visit)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #205
>
> **Track:** Fix · **Size:** S (1 step) · **From:** owner, 2026-10-14: "the site is not loading" … "error preloading worldmap css, deploy ok?"

## What was wrong

- The deploy was fine: `https://acars.pub/assets/WorldMap-JR8eJ17e.css` answers real CSS, and a fresh browser loads the app.
- The service worker (S34, `public/sw.js`) serves `/assets/*` cache first and stored any `200` response. Cloudflare Pages answers a missing file with the SPA page (HTML, status 200). A tab open across a deploy, or a bad response during one, stores that HTML under the asset's name, and from then on the device gets HTML for the stylesheet on every load: "Unable to preload CSS for /assets/WorldMap-….css". Reloading never helps, because the cache answers first.

## Fix

- `sw.js` keeps only real assets (never `text/html`), drops a cached HTML entry it finds, and renames its caches to `-v2`, so activation deletes the `-v1` caches that may be poisoned.
- The worker registers with `updateViaCache: "none"`, so browsers always fetch a fresh `sw.js`.
- `reloadOnStaleChunks()` (`shared/lib/serviceWorker.ts`): on `vite:preloadError` (a file from an older deploy is gone) the page reloads once to pick up the new build; a second failure within a minute shows the error instead of looping.

## Progress log

- 2026-10-14 · S80.1 · fix + unit tests (6) + a browser check against the built app with a Pages-style SPA fallback: the `-v1` cache is deleted, a missing file is not cached, the real file is cached once it exists.
- 2026-10-14 · S80.2 · CI's `verify` hit a flaky S72 test (`rank.test.ts`: the fake signer's one-second nudge kept the 6-bit work about 1 run in 64); it now nudges until the work is gone.
- 2026-10-14 · merged · #205 · CI green (verify, e2e, Pages).
