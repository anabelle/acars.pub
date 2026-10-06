import type { TimelineEvent } from "@acars/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  NOTIFICATION_SETTINGS_KEY,
  notificationCategory,
  planNotification,
  saveNotificationSettings,
} from "./notificationRules";

const event = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: "e1",
  tick: 1,
  timestamp: 1,
  type: "landing",
  description: "",
  ...overrides,
});
const ON = { ...DEFAULT_NOTIFICATION_SETTINGS, enabled: true };

describe("notificationCategory()", () => {
  it("maps important events to categories and ignores the rest", () => {
    expect(notificationCategory(event({ type: "maintenance", id: "evt-grounded-a1-1200" }))).toBe(
      "grounding",
    );
    expect(notificationCategory(event({ type: "maintenance", id: "evt-maint-a1" }))).toBeNull();
    expect(notificationCategory(event({ type: "tier_upgrade" }))).toBe("tierUp");
    expect(notificationCategory(event({ type: "competitor_route" }))).toBe("rivals");
    expect(notificationCategory(event({ type: "competitor_hub" }))).toBe("rivals");
    expect(notificationCategory(event({ type: "financial_warning" }))).toBe("finance");
    expect(notificationCategory(event({ type: "bankruptcy" }))).toBe("finance");
    expect(notificationCategory(event({ type: "landing" }))).toBeNull();
  });
});

describe("planNotification()", () => {
  const grounding = event({
    type: "maintenance",
    id: "evt-grounded-a1-1200",
    aircraftId: "a1",
    description: "[SAFETY ALERT] EC-ABC is GROUNDED. Maintenance required!",
  });

  it("plans a tagged notification without the log prefix", () => {
    expect(planNotification(grounding, ON)).toEqual({
      category: "grounding",
      tag: "acars-grounding-a1",
      body: "EC-ABC is GROUNDED. Maintenance required!",
    });
    const rival = planNotification(
      event({
        type: "competitor_route",
        originIata: "MAD",
        destinationIata: "BCN",
        description: "x",
      }),
      ON,
    );
    expect(rival?.tag).toBe("acars-rivals-MAD-BCN");
    expect(planNotification(event({ type: "tier_upgrade", description: "x" }), ON)?.tag).toBe(
      "acars-tierUp-tierUp",
    );
  });

  it("respects the master switch and each category", () => {
    expect(planNotification(grounding, DEFAULT_NOTIFICATION_SETTINGS)).toBeNull();
    expect(
      planNotification(grounding, { ...ON, categories: { ...ON.categories, grounding: false } }),
    ).toBeNull();
    expect(planNotification(event({ type: "landing" }), ON)).toBeNull();
  });
});

describe("settings storage", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it("round-trips and fills missing or invalid fields with defaults", () => {
    const storage = memory();
    expect(loadNotificationSettings(storage)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    saveNotificationSettings(storage, { ...ON, categories: { ...ON.categories, rivals: false } });
    expect(loadNotificationSettings(storage)).toEqual({
      enabled: true,
      categories: { ...ON.categories, rivals: false },
    });
    storage.setItem(NOTIFICATION_SETTINGS_KEY, '{"enabled":"yes","categories":{"tierUp":0}}');
    expect(loadNotificationSettings(storage)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    storage.setItem(NOTIFICATION_SETTINGS_KEY, "{not json");
    expect(loadNotificationSettings(storage)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it("tolerates missing or failing storage", () => {
    expect(loadNotificationSettings(null)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(() =>
      saveNotificationSettings(
        {
          setItem: () => {
            throw new Error("full");
          },
        },
        ON,
      ),
    ).not.toThrow();
  });
});
