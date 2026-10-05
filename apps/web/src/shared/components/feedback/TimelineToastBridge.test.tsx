import type { AirlineEntity, TimelineEvent } from "@acars/core";
import { TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { TimelineToastBridge } from "./TimelineToastBridge";

const landing = (id: string, tick: number): TimelineEvent => ({
  id,
  tick,
  timestamp: 0,
  type: "landing",
  description: `landed ${id}`,
});

const setTick = (lastTick: number, timeline: TimelineEvent[]) =>
  act(() => {
    useAirlineStore.setState({
      airline: { lastTick } as AirlineEntity,
      timeline,
    });
  });

const toastCount = () =>
  Object.values(toastMock).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

beforeEach(() => {
  useAirlineStore.setState({ airline: { lastTick: 1000 } as AirlineEntity, timeline: [] });
});

afterEach(() => {
  cleanup();
  for (const fn of Object.values(toastMock)) fn.mockReset();
});

describe("TimelineToastBridge", () => {
  it("toasts events as they happen live", () => {
    render(<TimelineToastBridge />);
    setTick(1001, [landing("a", 1001)]);
    setTick(1002, [landing("b", 1002), landing("a", 1001)]);
    expect(toastCount()).toBe(2);
  });

  it("stays quiet when an absence of an hour or more is caught up at once", () => {
    render(<TimelineToastBridge />);
    setTick(1001, [landing("a", 1001)]);
    expect(toastCount()).toBe(1);

    const burst = Array.from({ length: 8 }, (_, i) =>
      landing(`late-${i}`, 1001 + TICKS_PER_HOUR - i),
    );
    setTick(1001 + TICKS_PER_HOUR, [...burst, landing("a", 1001)]);
    expect(toastCount()).toBe(1);

    // Live toasts resume right after.
    setTick(1002 + TICKS_PER_HOUR, [landing("c", 1002 + TICKS_PER_HOUR), ...burst]);
    expect(toastCount()).toBe(2);
  });
});
