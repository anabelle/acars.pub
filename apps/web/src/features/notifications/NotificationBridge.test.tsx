import { TICKS_PER_HOUR, type TimelineEvent } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBridge } from "./NotificationBridge";
import type { Notifier } from "./notifier";
import { DEFAULT_NOTIFICATION_SETTINGS } from "./notificationRules";
import { resetNotificationSettingsCache, setNotificationSettings } from "./notificationSettings";

const initialAirline = useAirlineStore.getState();
const initialEngine = useEngineStore.getState();

const grounding: TimelineEvent = {
  id: "evt-grounded-a1-1200",
  tick: 1200,
  timestamp: 1,
  type: "maintenance",
  aircraftId: "a1",
  aircraftName: "EC-ABC",
  description: "[SAFETY ALERT] EC-ABC is GROUNDED. Condition: 18%. Maintenance required!",
};

function addEvent(event: TimelineEvent, ticks = 3) {
  act(() => {
    useAirlineStore.setState(
      (state) =>
        ({
          timeline: [event, ...state.timeline],
          airline: {
            ...(state.airline as object),
            lastTick: (state.airline?.lastTick ?? 0) + ticks,
          },
        }) as never,
    );
  });
}

function fakeNotifier(overrides: Partial<Notifier> = {}) {
  return {
    permission: () => "granted" as const,
    hidden: () => true,
    show: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  resetNotificationSettingsCache();
  setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, enabled: true });
  useAirlineStore.setState({ timeline: [], airline: { lastTick: 1000 } } as never);
  useEngineStore.setState({ catchupProgress: null } as never);
});

afterEach(() => {
  useAirlineStore.setState(initialAirline, true);
  useEngineStore.setState(initialEngine, true);
  resetNotificationSettingsCache();
});

describe("NotificationBridge", () => {
  it("notifies a simulated grounding while the app is out of view", () => {
    const notifier = fakeNotifier();
    render(<NotificationBridge notifier={notifier} />);
    addEvent(grounding);
    expect(notifier.show).toHaveBeenCalledWith("Aircraft grounded", {
      body: "EC-ABC is GROUNDED. Condition: 18%. Maintenance required!",
      tag: "acars-grounding-a1",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
  });

  it("stays quiet in view, without permission, when off, or for other events", () => {
    for (const notifier of [
      fakeNotifier({ hidden: () => false }),
      fakeNotifier({ permission: () => "default" }),
    ]) {
      const { unmount } = render(<NotificationBridge notifier={notifier} />);
      addEvent({ ...grounding, id: `${grounding.id}-${Math.random()}` });
      expect(notifier.show).not.toHaveBeenCalled();
      unmount();
    }
    const notifier = fakeNotifier();
    render(<NotificationBridge notifier={notifier} />);
    addEvent({ ...grounding, id: "evt-landing", type: "landing" });
    setNotificationSettings((s) => ({ ...s, enabled: false }));
    addEvent({ ...grounding, id: "evt-grounded-a2-2400" });
    expect(notifier.show).not.toHaveBeenCalled();
  });

  it("skips catch-ups after an absence", () => {
    const notifier = fakeNotifier();
    render(<NotificationBridge notifier={notifier} />);
    addEvent(grounding, TICKS_PER_HOUR);
    expect(notifier.show).not.toHaveBeenCalled();
  });

  it("logs a failed notification instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notifier = fakeNotifier({ show: vi.fn(async () => Promise.reject(new Error("x"))) });
    render(<NotificationBridge notifier={notifier} />);
    addEvent(grounding);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
