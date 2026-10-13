/**
 * Vite dev-server plugin that mirrors the CF Pages Function behaviour.
 *
 * Security layers (matching production):
 *   1. Origin validation — only localhost dev origins accepted.
 *   2. Per-IP rate limiting — max N requests per sliding window.
 *   3. Prompt format validation — rejects non-livery prompts.
 *
 * Reads `OPENAI_API_KEY` and/or `GEMINI_API_KEY` from the server-side
 * environment (NOT prefixed with VITE_, so they never leak into the client
 * bundle).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { isValidAircraftImagePrompt } from "../src/features/fleet/services/aircraftImagePromptValidation";
import { generateAircraftImage, hasImageKey } from "../src/features/fleet/services/imageProviders";

/** Maximum prompt length (chars). Longest realistic livery prompt is ~700 chars. */
const MAX_PROMPT_LENGTH = 1200;

// ---------------------------------------------------------------------------
// Origin validation
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://localhost:4173"]);

/** Returns true if the origin is an allowed dev or preview origin. */
function isAllowedOrigin(origin: string | undefined): boolean {
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
// Rate limiting (in-memory)
// ---------------------------------------------------------------------------

/**
 * Simple sliding-window rate limiter. More generous in dev (10 req/min)
 * to avoid blocking rapid iteration.
 */
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 10; // more generous in dev

interface RateBucket {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateBucket>();

/**
 * Returns true if the IP has exceeded the rate limit.
 * As a side-effect, records the current timestamp if not limited.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
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
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default function geminiProxy(): Plugin {
  return {
    name: "gemini-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/api/generate-livery",
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.writeHead(405);
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          // --- Origin validation ---
          const origin = req.headers.origin;
          if (!isAllowedOrigin(origin)) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: "Forbidden" }));
            return;
          }

          // --- Rate limiting ---
          const clientIp = req.socket.remoteAddress ?? "unknown";
          if (isRateLimited(clientIp)) {
            res.writeHead(429);
            res.end(
              JSON.stringify({
                error: "Rate limit exceeded. Try again in a minute.",
              }),
            );
            return;
          }

          // --- API keys ---
          const keys = {
            openai: process.env.OPENAI_API_KEY,
            gemini: process.env.GOOGLE_API ?? process.env.GEMINI_API_KEY,
          };
          if (!hasImageKey(keys)) {
            res.writeHead(500);
            res.end(
              JSON.stringify({
                error: "Image API secret is not configured (set OPENAI_API_KEY or GEMINI_API_KEY)",
              }),
            );
            return;
          }

          // --- Parse body ---
          let body: { prompt: string };
          try {
            body = JSON.parse(await readBody(req));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }

          if (typeof body.prompt !== "string" || !body.prompt.trim()) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Missing prompt" }));
            return;
          }

          // --- Prompt validation ---
          if (!isValidAircraftImagePrompt(body.prompt, MAX_PROMPT_LENGTH)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid prompt format" }));
            return;
          }

          // --- Generate (each configured provider's models, in order) ---
          const result = await generateAircraftImage(body.prompt, keys);
          if (result.ok) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result.image));
            return;
          }
          res.writeHead(424);
          res.end(JSON.stringify({ error: result.error }));
        },
      );
    },
  };
}
