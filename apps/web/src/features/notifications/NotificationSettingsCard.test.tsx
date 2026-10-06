import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSettingsCard } from "./NotificationSettingsCard";
import { getNotificationSettings, resetNotificationSettingsCache } from "./notificationSettings";
import type { PermissionApi, PermissionState } from "./permission";

const api = (current: PermissionState, answer: PermissionState = current): PermissionApi => ({
  current: () => current,
  request: vi.fn(async () => answer),
});

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  resetNotificationSettingsCache();
});

describe("NotificationSettingsCard", () => {
  it("asks for permission, turns alerts on and lets you pick categories", async () => {
    const permission = api("default", "granted");
    render(<NotificationSettingsCard permissionApi={permission} />);
    expect(screen.getByText("Alerts on this device")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("notifications-turn-on"));
    });
    expect(permission.request).toHaveBeenCalled();
    expect(getNotificationSettings().enabled).toBe(true);

    const rivals = screen.getByTestId("notification-category-rivals");
    expect(rivals).toBeChecked();
    fireEvent.click(rivals);
    expect(getNotificationSettings().categories.rivals).toBe(false);
    expect(screen.getByText("Groundings")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("notifications-turn-off"));
    expect(getNotificationSettings().enabled).toBe(false);
    expect(screen.getByTestId("notifications-turn-on")).toBeInTheDocument();
  });

  it("doesn't enable alerts when permission is refused", async () => {
    render(<NotificationSettingsCard permissionApi={api("default", "denied")} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("notifications-turn-on"));
    });
    expect(getNotificationSettings().enabled).toBe(false);
    expect(screen.getByTestId("notifications-blocked")).toBeInTheDocument();
  });

  it("re-enables without asking when permission is already granted", async () => {
    const permission = api("granted");
    render(<NotificationSettingsCard permissionApi={permission} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("notifications-turn-on"));
    });
    expect(permission.request).not.toHaveBeenCalled();
    expect(getNotificationSettings().enabled).toBe(true);
  });

  it("explains blocked and unsupported notifications", () => {
    const { unmount } = render(<NotificationSettingsCard permissionApi={api("denied")} />);
    expect(screen.getByTestId("notifications-blocked")).toHaveTextContent(/blocked/i);
    unmount();
    render(<NotificationSettingsCard permissionApi={api("unsupported")} />);
    expect(screen.getByTestId("notifications-unsupported")).toBeInTheDocument();
  });
});
