import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker, reloadOnStaleChunks } from "./serviceWorker";

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
    expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
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
    expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
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

describe("reloadOnStaleChunks()", () => {
  function setup(start = 1_000_000) {
    let handler: ((event: Event) => void) | undefined;
    const stored = new Map<string, string>();
    let clock = start;
    const reload = vi.fn();
    reloadOnStaleChunks({
      windowLike: {
        addEventListener: (_type: string, listener: (event: Event) => void) => {
          handler = listener;
        },
      } as unknown as Window,
      storage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v) },
      reload,
      now: () => clock,
    });
    const fire = () => {
      const event = { preventDefault: vi.fn() } as unknown as Event;
      handler?.(event);
      return event;
    };
    return { fire, reload, advance: (ms: number) => (clock += ms) };
  }

  it("reloads once when a file from an older deploy is gone", () => {
    const { fire, reload } = setup();
    const event = fire();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("does not loop: a second failure within a minute surfaces the error", () => {
    const { fire, reload, advance } = setup();
    fire();
    advance(5_000);
    const event = fire();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
    advance(60_000);
    fire();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
