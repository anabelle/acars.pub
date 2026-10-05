import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const relays = vi.hoisted(() => ({ count: 0, reconnect: vi.fn(async () => {}) }));
vi.mock("@acars/nostr", () => ({
  connectedRelayCount: () => relays.count,
  reconnectIfNeeded: () => relays.reconnect(),
}));

import { RelayStatusBadge } from "./RelayStatusBadge";

beforeEach(() => {
  vi.useFakeTimers();
  relays.count = 0;
  relays.reconnect.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const badge = () => screen.getByTestId("relay-status");

describe("RelayStatusBadge (S21)", () => {
  it("shows connecting, then offline with a retry when relays stay down", async () => {
    render(<RelayStatusBadge />);
    expect(badge().dataset.status).toBe("connecting");
    expect(badge().textContent).toMatch(/Connecting to relays/);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(badge().dataset.status).toBe("offline");

    // Retrying while relays are still down keeps it offline but does try.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    });
    expect(relays.reconnect).toHaveBeenCalledTimes(1);
    expect(badge().dataset.status).toBe("offline");
  });

  it("turns ready with the relay count once relays connect", async () => {
    render(<RelayStatusBadge />);
    relays.count = 3;
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(badge().dataset.status).toBe("ready");
    expect(badge().textContent).toMatch(/Connected to 3 relays/);
  });

  it("recovers from offline when a retry connects", async () => {
    render(<RelayStatusBadge />);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(badge().dataset.status).toBe("offline");

    relays.reconnect.mockImplementationOnce(async () => {
      relays.count = 1;
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    });
    expect(badge().dataset.status).toBe("ready");
    expect(badge().textContent).toMatch(/Connected to 1 relay$/);
  });
});
