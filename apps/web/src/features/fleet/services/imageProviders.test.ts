import { describe, expect, it, vi } from "vitest";
import { generateAircraftImage, sniffMimeType } from "./imageProviders";

const PNG = "iVBORw0KGgoAAAANSUhEUg";
const JPEG = "/9j/4AAQSkZJRg";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("generateAircraftImage", () => {
  it("prefers OpenAI when its key is set", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [{ b64_json: PNG }] }));
    const result = await generateAircraftImage(
      "a plane",
      { openai: "sk-1", gemini: "g-1" },
      fetchImpl,
    );
    expect(result).toEqual({
      ok: true,
      image: { imageBase64: PNG, mimeType: "image/png", provider: "openai", model: "gpt-image-2" },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-1");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "gpt-image-2",
      size: "1536x1024",
    });
  });

  it("falls back through OpenAI models, then to Gemini's generateContent", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "model not found" } }, 404))
      .mockResolvedValueOnce(json({ error: { message: "billing hard limit" } }, 400))
      .mockResolvedValueOnce(
        json({
          candidates: [
            {
              content: {
                parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: PNG } }],
              },
            },
          ],
        }),
      );
    const result = await generateAircraftImage("a plane", { openai: "sk", gemini: "g" }, fetchImpl);
    expect(result.ok && result.image).toMatchObject({
      provider: "gemini",
      model: "gemini-3.1-flash-image",
    });
    const [url, init] = fetchImpl.mock.calls[2] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.1-flash-image:generateContent");
    expect(url).not.toContain("key=");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g");
  });

  it("says why every attempt failed, without leaking keys", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: "bad key=SECRET123" } }, 403));
    const result = await generateAircraftImage("a plane", { gemini: "SECRET123" }, fetchImpl);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("gemini gemini-3.1-flash-image: HTTP 403");
    expect(result.error).toContain("gemini gemini-2.5-flash-image: HTTP 403");
    expect(result.error).not.toContain("SECRET123");
  });

  it("needs a key", async () => {
    expect(await generateAircraftImage("a plane", {}, vi.fn())).toEqual({
      ok: false,
      error: "No image API key is configured",
    });
  });
});

describe("sniffMimeType", () => {
  it("reads the type from the first bytes", () => {
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(JPEG)).toBe("image/jpeg");
  });
});
