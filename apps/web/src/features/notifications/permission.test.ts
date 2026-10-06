import { afterEach, describe, expect, it, vi } from "vitest";
import { browserPermission } from "./permission";

afterEach(() => vi.unstubAllGlobals());

describe("browserPermission", () => {
  it("reads and requests the Notification permission", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: async () => "granted",
    });
    expect(browserPermission.current()).toBe("default");
    await expect(browserPermission.request()).resolves.toBe("granted");
  });

  it("is unsupported without the API", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(browserPermission.current()).toBe("unsupported");
    await expect(browserPermission.request()).resolves.toBe("unsupported");
  });
});
