import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./serviceWorker";

function fakeWindow() {
  const listeners: Record<string, () => void> = {};
  return {
    windowLike: {
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener;
      },
    } as unknown as Window,
    fireLoad: () => listeners.load?.(),
  };
}

describe("registerServiceWorker()", () => {
  it("registers /sw.js after load in production", async () => {
    const register = vi.fn(async () => ({}));
    const { windowLike, fireLoad } = fakeWindow();
    const attempted = registerServiceWorker({
      production: true,
      navigatorLike: { serviceWorker: { register } } as never,
      windowLike,
      documentLike: { readyState: "loading" },
    });
    expect(attempted).toBe(true);
    expect(register).not.toHaveBeenCalled();
    fireLoad();
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("registers right away when the page has already loaded", () => {
    const register = vi.fn(async () => ({}));
    const { windowLike } = fakeWindow();
    registerServiceWorker({
      production: true,
      navigatorLike: { serviceWorker: { register } } as never,
      windowLike,
      documentLike: { readyState: "complete" },
    });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("logs a failed registration instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { windowLike, fireLoad } = fakeWindow();
    registerServiceWorker({
      production: true,
      navigatorLike: {
        serviceWorker: { register: vi.fn(async () => Promise.reject(new Error("x"))) },
      } as never,
      windowLike,
    });
    fireLoad();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });

  it("does nothing in development or without service worker support", () => {
    const { windowLike } = fakeWindow();
    expect(registerServiceWorker({ production: false, windowLike })).toBe(false);
    expect(
      registerServiceWorker({ production: true, navigatorLike: {} as never, windowLike }),
    ).toBe(false);
    // jsdom (the test run) is not a production build.
    expect(registerServiceWorker()).toBe(false);
  });
});
