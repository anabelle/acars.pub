import { describe, expect, it, vi } from "vitest";
import { type ShareApi, shareFileName, shareNetwork, summaryFromState } from "./shareNetwork";

const airline = {
  name: "  Iberia Nova  ",
  icaoCode: "IBRN",
  tier: 2,
  hubs: ["MAD"],
  livery: { primary: "#c8102e", secondary: "#ffffff", accent: "#ffcc00" },
};
const summary = summaryFromState(
  airline,
  [{ liveryImageUrl: "https://blossom.example/a.png" }, { liveryImageUrl: undefined }],
  [
    { originIata: "MAD", destinationIata: "BCN", status: "active" },
    { originIata: "MAD", destinationIata: "LIS", status: "suspended" },
  ],
);
const airports: Record<string, { iata: string; latitude: number; longitude: number }> = {
  MAD: { iata: "MAD", latitude: 40.47, longitude: -3.56 },
  BCN: { iata: "BCN", latitude: 41.3, longitude: 2.08 },
};
const base = {
  summary,
  url: "https://acars.pub/airline/npub1x",
  title: "Iberia Nova",
  text: "My airline",
  airportByIata: (iata: string) => airports[iata],
  fileName: "acars-ibrn-network.png",
};
const api = (overrides: Partial<ShareApi>): ShareApi => ({
  writeText: vi.fn(async () => {}),
  ...overrides,
});

describe("summaryFromState()", () => {
  it("summarises the live airline like the link preview does", () => {
    expect(summary).toMatchObject({
      name: "Iberia Nova",
      icaoCode: "IBRN",
      tier: 2,
      aircraft: 2,
      routes: 1,
      hubs: ["MAD"],
      colors: { primary: "#c8102e", accent: "#ffcc00" },
      routeList: [{ originIata: "MAD", destinationIata: "BCN" }],
      liveryImageUrl: "https://blossom.example/a.png",
    });
  });
});

describe("shareNetwork()", () => {
  it("shares the image and the link when files can be shared", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    const outcome = await shareNetwork({
      ...base,
      api: api({ share, canShare: (data) => Boolean(data.files?.length) }),
    });
    expect(outcome).toEqual({ kind: "sharedImage" });
    const data = share.mock.calls[0][0];
    expect(data.url).toBe(base.url);
    expect(data.files?.[0].name).toBe("acars-ibrn-network.png");
    expect(data.files?.[0].type).toBe("image/png");
  });

  it("shares the link alone when files can't be shared", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    const outcome = await shareNetwork({ ...base, api: api({ share, canShare: () => false }) });
    expect(outcome).toEqual({ kind: "sharedLink" });
    expect(share.mock.calls[0][0]).toEqual({ title: base.title, text: base.text, url: base.url });
  });

  it("copies the link and hands back the image without a share sheet", async () => {
    const writeText = vi.fn(async () => {});
    const outcome = await shareNetwork({ ...base, api: { writeText } });
    expect(writeText).toHaveBeenCalledWith(base.url);
    expect(outcome.kind).toBe("copied");
    if (outcome.kind === "copied") {
      const bytes = new Uint8Array(await outcome.image.arrayBuffer());
      expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
    }
  });

  it("treats a dismissed share sheet as cancelled, and other failures as copy", async () => {
    const dismissed = await shareNetwork({
      ...base,
      api: api({
        share: async () => {
          throw new DOMException("dismissed", "AbortError");
        },
      }),
    });
    expect(dismissed).toEqual({ kind: "cancelled" });

    const writeText = vi.fn(async () => {});
    const failed = await shareNetwork({
      ...base,
      api: {
        writeText,
        share: async () => {
          throw new DOMException("no", "NotAllowedError");
        },
      },
    });
    expect(failed.kind).toBe("copied");
    expect(writeText).toHaveBeenCalled();
  });
});

describe("shareFileName()", () => {
  it("is a tidy file name", () => {
    expect(shareFileName("IB-R")).toBe("acars-ibr-network.png");
    expect(shareFileName("")).toBe("acars-airline-network.png");
  });
});
