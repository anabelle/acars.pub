import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const ndkConstructorMock = vi.fn();

vi.mock("@nostr-dev-kit/ndk", () => {
  class NDK {
    public connect = connectMock;
    constructor(options?: unknown) {
      ndkConstructorMock(options);
    }
  }
  return { default: NDK };
});

import { ensureConnected, getNDK } from "./ndk.js";

describe("ndk", () => {
  beforeEach(() => {
    connectMock.mockReset();
    ndkConstructorMock.mockReset();
  });

  it("creates a singleton instance with relay urls", () => {
    const first = getNDK();
    const second = getNDK();
    expect(first).toBe(second);
    expect(ndkConstructorMock).toHaveBeenCalledTimes(1);
    expect(ndkConstructorMock.mock.calls[0]?.[0]).toMatchObject({
      explicitRelayUrls: expect.any(Array),
    });
  });

  it("connects only once for concurrent calls", async () => {
    connectMock.mockResolvedValue(undefined);
    await Promise.all([ensureConnected(), ensureConnected(), ensureConnected()]);
    expect(connectMock).toHaveBeenCalledTimes(1);
  }, 10000);
});
