import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_SETTINGS_KEY } from "./notificationRules";
import {
  getNotificationSettings,
  resetNotificationSettingsCache,
  setNotificationSettings,
  useNotificationSettings,
} from "./notificationSettings";

beforeEach(() => {
  localStorage.clear();
  resetNotificationSettingsCache();
});

describe("notification settings store", () => {
  it("loads defaults, persists updates and notifies subscribers", () => {
    expect(getNotificationSettings()).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    const { result } = renderHook(() => useNotificationSettings());
    act(() => setNotificationSettings((s) => ({ ...s, enabled: true })));
    expect(result.current.enabled).toBe(true);
    expect(JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) ?? "{}").enabled).toBe(true);
    act(() => setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS));
    expect(result.current).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it("reads what an earlier visit saved", () => {
    localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify({ enabled: true, categories: { rivals: false } }),
    );
    expect(getNotificationSettings().categories.rivals).toBe(false);
  });
});
