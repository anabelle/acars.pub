/**
 * Root-level Cloudflare Pages Function — aircraft image proxy (OpenAI first
 * when `OPENAI_API_KEY` is set, then Gemini; see `imageProviders.ts`).
 *
 * Security layers:
 *   1. Origin validation — only requests from acars.pub / localhost are accepted.
 *   2. Per-IP rate limiting — max N requests per sliding window, in-memory.
 *   3. Prompt format validation — rejects prompts that don't match the
 *      expected livery prompt structure (prevents arbitrary image generation).
 *
 * This file is intentionally a full inline copy (not a re-export)
 * because CF Pages only injects env bindings for handlers defined
 * directly inside `/functions`.  Cross-directory re-exports lose
 * `context.env` at runtime.
 */

import {
  generateAircraftImage,
  hasImageKey,
  type ImageKeys,
} from "../../apps/web/src/features/fleet/services/imageProviders";

interface Env {
  OPENAI_API_KEY?: string;
  GOOGLE_API?: string;
  GEMINI_API_KEY?: string;
  CF_PAGES_BRANCH?: string;
}

interface RequestBody {
  prompt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum prompt length (chars). Longest realistic livery prompt is ~700 chars. */
const MAX_PROMPT_LENGTH = 1200;

// ---------------------------------------------------------------------------
// Origin validation
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  "https://acars.pub",
  "https://www.acars.pub",
  "http://localhost:5173",
  "http://localhost:4173",
]);

/** Returns true if the origin is an allowed production, preview, or dev origin. */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // CF Pages preview deployments: <hash>.acars.pages.dev
  try {
    const url = new URL(origin);
    return url.hostname.endsWith(".acars.pages.dev");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per-isolate)
// ---------------------------------------------------------------------------

/**
 * Simple sliding-window rate limiter. CF Pages Functions run in isolates
 * that may be recycled, so this is best-effort per-instance. For stronger
 * guarantees use Cloudflare KV or D1 — but this catches the vast majority
 * of abuse at zero cost.
 */
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 5; // max 5 requests per IP per minute

interface RateBucket {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateBucket>();

/** Prune stale entries periodically to prevent unbounded memory growth. */
let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 300_000; // 5 minutes

function pruneRateLimitMap(now: number): void {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  const cutoff = now - RATE_WINDOW_MS;
  for (const [ip, bucket] of rateLimitMap) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) {
      rateLimitMap.delete(ip);
    }
  }
}

/**
 * Returns true if the IP has exceeded the rate limit.
 * As a side-effect, records the current timestamp if not limited.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  pruneRateLimitMap(now);

  const cutoff = now - RATE_WINDOW_MS;
  let bucket = rateLimitMap.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateLimitMap.set(ip, bucket);
  }

  // Drop timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= RATE_MAX_REQUESTS) {
    return true;
  }

  bucket.timestamps.push(now);
  return false;
}

// ---------------------------------------------------------------------------
// Prompt validation
// ---------------------------------------------------------------------------

const LIVERY_REQUIRED_PHRASES = [
  "professional aviation photography of a",
  "commercial",
  "aircraft",
  "in the livery of",
  "airline",
  "photorealistic quality, cinematic aviation scene",
] as const;

const CATALOG_REQUIRED_PHRASES = [
  "professional aviation photography of a",
  "commercial",
  "aircraft",
  "factory delivery configuration with manufacturer colors",
  "delivery hangar",
  "photorealistic quality, cinematic aviation scene",
] as const;

function isValidAircraftImagePrompt(prompt: string): boolean {
  if (prompt.length > MAX_PROMPT_LENGTH) return false;
  const lower = prompt.toLowerCase();
  const matchesLivery = LIVERY_REQUIRED_PHRASES.every((phrase) => lower.includes(phrase));
  const matchesCatalog = CATALOG_REQUIRED_PHRASES.every((phrase) => lower.includes(phrase));
  return matchesLivery || matchesCatalog;
}

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

function resolveKeys(env: Env): ImageKeys {
  // Server-side only. Never read VITE_* variables here: anything prefixed
  // VITE_ is inlined into the client bundle at build time by Vite.
  let processEnv: Record<string, string | undefined> = {};
  try {
    const p = (globalThis as Record<string, unknown>).process as
      | { env?: Record<string, string> }
      | undefined;
    if (p?.env) processEnv = p.env;
  } catch {
    /* not available */
  }
  return {
    openai: env.OPENAI_API_KEY ?? processEnv.OPENAI_API_KEY,
    gemini:
      env.GOOGLE_API ?? env.GEMINI_API_KEY ?? processEnv.GOOGLE_API ?? processEnv.GEMINI_API_KEY,
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export const onRequest: PagesFunction<Env> = async (context) => {
  // --- Method check ---
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // --- Origin validation ---
  const origin = context.request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Rate limiting ---
  const clientIp =
    context.request.headers.get("cf-connecting-ip") ??
    context.request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(clientIp)) {
    return Response.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  // --- API keys ---
  const env = context.env ?? ({} as Env);
  const keys = resolveKeys(env);
  if (!hasImageKey(keys)) {
    const branch = env.CF_PAGES_BRANCH ?? "unknown";
    return Response.json(
      {
        error: "Image API secret is not configured",
        hint: "Set OPENAI_API_KEY (or GEMINI_API_KEY) for BOTH Production and Preview in the CF Pages dashboard",
        branch,
      },
      { status: 500 },
    );
  }

  // --- Parse body ---
  let body: RequestBody;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  // --- Prompt validation ---
  if (!isValidAircraftImagePrompt(body.prompt)) {
    return Response.json({ error: "Invalid prompt format" }, { status: 400 });
  }

  // --- Generate (each configured provider's models, in order) ---
  const result = await generateAircraftImage(body.prompt, keys);
  if (result.ok) {
    return Response.json({
      imageBase64: result.image.imageBase64,
      mimeType: result.image.mimeType,
      provider: result.image.provider,
      model: result.image.model,
    });
  }
  // 424, not 502: Cloudflare replaces 502 bodies with its own page, which hid
  // the real reason (S79: the Imagen models had been shut down).
  return Response.json({ error: result.error }, { status: 424 });
};
