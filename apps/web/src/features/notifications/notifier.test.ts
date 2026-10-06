import { afterEach, describe, expect, it, vi } from "vitest";
import { browserNotifier } from "./notifier";

afterEach(() => vi.unstubAllGlobals());

describe("browserNotifier", () => {
  it("reports permission, or unsupported without the API", () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    expect(browserNotifier.permission()).toBe("granted");
    vi.stubGlobal("Notification", undefined);
    expect(browserNotifier.permission()).toBe("unsupported");
  });

  it("is hidden unless the document is visible", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    expect(browserNotifier.hidden()).toBe(true);
    visibility.mockReturnValue("visible");
    expect(browserNotifier.hidden()).toBe(false);
    visibility.mockRestore();
  });

  it("shows through the service worker when registered, else directly", async () => {
    const showNotification = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: async () => ({ showNotification }) },
    });
    await browserNotifier.show("T", { body: "b" });
    expect(showNotification).toHaveBeenCalledWith("T", { body: "b" });

    const constructed: unknown[] = [];
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => undefined } });
    vi.stubGlobal(
      "Notification",
      class {
        constructor(...args: unknown[]) {
          constructed.push(args);
        }
      },
    );
    await browserNotifier.show("T", { body: "b" });
    expect(constructed).toEqual([["T", { body: "b" }]]);
  });
});
