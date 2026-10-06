import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setMaintenancePolicy = vi.fn<(policy: unknown, aircraftId?: string) => Promise<void>>(
  async () => {},
);
const store: { policy: unknown } = { policy: undefined };
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ airline: { maintenancePolicy: store.policy }, setMaintenancePolicy }),
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { AircraftMaintenanceRow } from "./AircraftMaintenanceRow";
import { MaintenancePolicyControl } from "./MaintenancePolicyControl";

const ON = { enabled: true, minCondition: 0.4, hubOnly: false };

afterEach(() => {
  cleanup();
  setMaintenancePolicy.mockReset();
  toast.error.mockClear();
  store.policy = undefined;
});

describe("MaintenancePolicyControl", () => {
  it("starts off and turns the fleet default on", async () => {
    render(<MaintenancePolicyControl />);
    const toggle = screen.getByRole("switch", { name: "Auto-maintenance" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    await waitFor(() => expect(setMaintenancePolicy).toHaveBeenCalledWith({ ...ON }));
  });

  it("changes threshold and hub-only", async () => {
    store.policy = ON;
    render(<MaintenancePolicyControl />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0.6" } });
    await waitFor(() =>
      expect(setMaintenancePolicy).toHaveBeenCalledWith({ ...ON, minCondition: 0.6 }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Only at a hub" }));
    await waitFor(() =>
      expect(setMaintenancePolicy).toHaveBeenCalledWith({ ...ON, hubOnly: true }),
    );
  });

  it("reports a failed save", async () => {
    setMaintenancePolicy.mockRejectedValueOnce(new Error("relay down"));
    render(<MaintenancePolicyControl />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save the maintenance policy", {
        description: "relay down",
      }),
    );
  });
});

describe("AircraftMaintenanceRow", () => {
  const model = { speedKmh: 500, blockHoursPerDay: 12 } as never;
  const route = { distanceKm: 500, frequencyPerWeek: 7, assignedAircraftIds: ["a1"] } as never;
  const aircraft = (extra: Record<string, unknown> = {}) =>
    ({ id: "a1", condition: 1, flightHoursSinceCheck: 0, ...extra }) as never;

  it("follows the fleet default and shows the next service", () => {
    render(
      <AircraftMaintenanceRow aircraft={aircraft()} model={model} route={route} fleetPolicy={ON} />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("inherit");
    expect(screen.getByText("Fleet default (on)")).toBeInTheDocument();
    // 540 h at 2 h/day.
    expect(screen.getByText("Next service in ~270 days")).toBeInTheDocument();
  });

  it("warns about grounding with the policy off", () => {
    render(<AircraftMaintenanceRow aircraft={aircraft()} model={model} route={route} />);
    expect(screen.getByText("Fleet default (off)")).toBeInTheDocument();
    expect(screen.getByText("Grounds in ~300 days unless serviced")).toBeInTheDocument();
  });

  it("says when service is due or grounding is now", () => {
    const { rerender } = render(
      <AircraftMaintenanceRow
        aircraft={aircraft({ condition: 0.3 })}
        model={model}
        route={route}
        fleetPolicy={ON}
      />,
    );
    expect(screen.getByText("Service due at the next turnaround")).toBeInTheDocument();
    rerender(
      <AircraftMaintenanceRow
        aircraft={aircraft({ condition: 0.1 })}
        model={model}
        route={route}
      />,
    );
    expect(screen.getByText("Grounding: service it now")).toBeInTheDocument();
  });

  it("sets and clears an override using the fleet threshold", async () => {
    const fleet = { enabled: false, minCondition: 0.5, hubOnly: true };
    render(
      <AircraftMaintenanceRow
        aircraft={aircraft({ maintenancePolicy: { ...fleet, enabled: true } })}
        model={model}
        route={null}
        fleetPolicy={fleet}
      />,
    );
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("on");
    fireEvent.change(select, { target: { value: "off" } });
    await waitFor(() =>
      expect(setMaintenancePolicy).toHaveBeenCalledWith({ ...fleet, enabled: false }, "a1"),
    );
    fireEvent.change(select, { target: { value: "inherit" } });
    await waitFor(() => expect(setMaintenancePolicy).toHaveBeenCalledWith(null, "a1"));
  });

  it("shows an 'off' override, reports failures, and hides the control read-only", async () => {
    setMaintenancePolicy.mockRejectedValueOnce(new Error("nope"));
    const { rerender } = render(
      <AircraftMaintenanceRow
        aircraft={aircraft({ maintenancePolicy: { ...ON, enabled: false } })}
        model={model}
        route={route}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("off");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "on" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    rerender(<AircraftMaintenanceRow aircraft={aircraft()} model={model} route={route} readOnly />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
