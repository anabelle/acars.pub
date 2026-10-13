# S79 — Aircraft images work again (OpenAI or Gemini)

> **Status:** ◑ in review
> **Next step:** — (owner: set `OPENAI_API_KEY` in Cloudflare Pages for Production and Preview; merge)
> **Branch:** `claude/zen-darwin-3op878`
> **PR:** #204
>
> **Track:** Fix · **Size:** S (1 step) · **From:** owner, 2026-10-13: "i think image generation is failing" … "if it costs lets just use the openai subs which im paying fo"

## What was wrong

- `POST https://acars.pub/api/generate-livery` with a valid prompt answered a bare Cloudflare `error code: 502` in about a second. The function passed origin, rate limit, key and prompt checks, then every model failed: it asked Google for `imagen-4.0-generate-001` and `imagen-3.0-generate-002` through `:predict`. Google shut Imagen 3 down on 2025-11-10 and Imagen 4 on 2026-08-17 (deprecations page, updated 2026-10-12). Every catalog photo and livery has failed since.
- The function answered 502 on upstream failure, and Cloudflare replaces 502 bodies with its own page, so the real reason never reached the client.
- Preview deployments (`*.acars.pages.dev`) have no key at all ("Gemini API secret is not configured", branch `claude/zen-darwin-3op878`).

## Fix

- `apps/web/src/features/fleet/services/imageProviders.ts` (server-only, shared by the Pages Function and the dev proxy): OpenAI first when `OPENAI_API_KEY` is set (`gpt-image-2`, then `gpt-image-1`; `/v1/images/generations`, 1536×1024, medium quality, `b64_json`), then Gemini when `GOOGLE_API`/`GEMINI_API_KEY` is set (`gemini-3.1-flash-image`, then `gemini-2.5-flash-image`; `:generateContent` with `responseModalities: ["IMAGE"]`, 16:9, key in the `x-goog-api-key` header). 75 s per attempt; errors list every attempt, keys scrubbed.
- The function and the dev proxy use it; upstream failure answers 424 with the reasons (readable, not masked). The client no longer chooses models and waits up to 100 s.

## Owner setup

A ChatGPT subscription does not include API access: the OpenAI API is billed separately at platform.openai.com (a medium 1536×1024 image costs a few cents; catalog photos are made once per model and cached on Blossom; liveries once per plane). Either:

1. OpenAI: create an API key at platform.openai.com (with billing), then in Cloudflare Pages → acars → Settings → Environment variables add `OPENAI_API_KEY` as a secret for **Production and Preview**; or
2. Gemini: keep the existing `GOOGLE_API`/`GEMINI_API_KEY` (it now uses the Gemini image models, which need a billed Google AI Studio project).
   Then redeploy (a new push or "Retry deployment").

## Progress log

2026-10-13 · S79.1 · (this commit) · Diagnosed live (production 502 after the key check; preview missing the key), confirmed the Imagen shutdowns on Google's deprecations page, moved generation to `imageProviders.ts` with OpenAI first and Gemini `generateContent` second; function and dev proxy share it; 424 instead of a masked 502. Tests: imageProviders 5 (new). Typecheck (web, functions), lint, fleet tests green.

2026-10-13 · branch · (this commit) · The owner asked why every PR lists ~200 commits: the post-merge `merge -s ours` reset carried every already-squashed commit forward. The branch was rebuilt on `origin/main` with only this session's commits (force-push with lease, same tree); IMPLEMENTATION.md now says to restart the branch from main after a merge.

2026-10-13 · S79.2 · (this commit) · **Owner: "plan a day → select a route dropdown, the focus jumps to the close button insistently and closes the dropdown".** The day planner focused its close button in an effect keyed on `onClose`; the plane panel re-renders every game tick with a fresh `onClose`, so every tick stole focus back and shut the open select. `useDialogFocus` (shared/hooks) focuses once when a dialog opens and reads the latest `onClose`/escape-disabled through refs; the day planner, milestone celebrations, away report and delivery ceremony (same pattern) use it. Tests: useDialogFocus 2 (focus survives re-renders; Escape uses the latest onClose, not while disabled).
