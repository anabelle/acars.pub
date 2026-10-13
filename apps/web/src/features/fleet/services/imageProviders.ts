/**
 * Server-side image generation for aircraft pictures (catalog photos and
 * liveries), shared by the Cloudflare Pages Function and the Vite dev proxy.
 * Never imported by the client: it talks to the providers with the server's
 * keys.
 *
 * Providers, in order: OpenAI (when `OPENAI_API_KEY` is set), then Gemini
 * (`GOOGLE_API` / `GEMINI_API_KEY`). Google shut the Imagen `:predict` models
 * down (Imagen 3 on 2025-11-10, Imagen 4 on 2026-08-17), so Gemini goes
 * through its image models' `generateContent`.
 */

export const OPENAI_IMAGE_MODELS = ["gpt-image-2", "gpt-image-1"] as const;
export const GEMINI_IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"] as const;

/** OpenAI image models can take most of a minute; each attempt gets this long. */
export const PROVIDER_TIMEOUT_MS = 75_000;

export interface ImageKeys {
  openai?: string;
  gemini?: string;
}

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  provider: "openai" | "gemini";
  model: string;
}

export type GenerateResult = { ok: true; image: GeneratedImage } | { ok: false; error: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function hasImageKey(keys: ImageKeys): boolean {
  return Boolean(keys.openai || keys.gemini);
}

/** The image type from its first bytes (base64), for providers that don't say. */
export function sniffMimeType(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

/** A short, key-free reason for a failed attempt. */
function describeFailure(provider: string, model: string, status: number, text: string): string {
  let reason = text;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string };
    const error = parsed.error;
    reason = typeof error === "string" ? error : (error?.message ?? text);
  } catch {
    /* plain text */
  }
  reason = reason
    .replace(/key=[^&\s"]+/g, "key=…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return `${provider} ${model}: HTTP ${status}${reason ? ` — ${reason}` : ""}`;
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function tryOpenAi(
  prompt: string,
  key: string,
  model: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<GenerateResult> {
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetchImpl("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal,
      body: JSON.stringify({ model, prompt, n: 1, size: "1536x1024", quality: "medium" }),
    });
    if (!res.ok) {
      return { ok: false, error: describeFailure("openai", model, res.status, await res.text()) };
    }
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const imageBase64 = data.data?.find((item) => item.b64_json)?.b64_json;
    if (!imageBase64) return { ok: false, error: `openai ${model}: no image in the response` };
    return {
      ok: true,
      image: { imageBase64, mimeType: sniffMimeType(imageBase64), provider: "openai", model },
    };
  });
}

interface GeminiPart {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

async function tryGemini(
  prompt: string,
  key: string,
  model: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<GenerateResult> {
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: describeFailure("gemini", model, res.status, await res.text()) };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    for (const candidate of data.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) {
          const mimeType =
            (part.inlineData?.mimeType ?? part.inline_data?.mime_type) ||
            sniffMimeType(inline.data);
          return {
            ok: true,
            image: { imageBase64: inline.data, mimeType, provider: "gemini", model },
          };
        }
      }
    }
    return { ok: false, error: `gemini ${model}: no image in the response` };
  });
}

/**
 * Generates one 16:9 aircraft picture: every configured provider's models in
 * order, until one returns an image. The error lists each failed attempt.
 */
export async function generateAircraftImage(
  prompt: string,
  keys: ImageKeys,
  fetchImpl: FetchLike = fetch,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<GenerateResult> {
  const attempts: Array<() => Promise<GenerateResult>> = [];
  if (keys.openai) {
    const key = keys.openai;
    for (const model of OPENAI_IMAGE_MODELS) {
      attempts.push(() => tryOpenAi(prompt, key, model, fetchImpl, timeoutMs));
    }
  }
  if (keys.gemini) {
    const key = keys.gemini;
    for (const model of GEMINI_IMAGE_MODELS) {
      attempts.push(() => tryGemini(prompt, key, model, fetchImpl, timeoutMs));
    }
  }
  if (attempts.length === 0) return { ok: false, error: "No image API key is configured" };

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result.ok) return result;
      errors.push(result.error);
    } catch (error) {
      errors.push(
        error instanceof Error && error.name === "AbortError"
          ? "upstream request timed out"
          : error instanceof Error
            ? error.message
            : "unknown error",
      );
    }
  }
  return { ok: false, error: errors.join(" | ") };
}
