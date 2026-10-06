import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ferryAircraft = vi.fn<(aircraftId: string, to: string) => Promise<void>>(async () => {});
const state = { pubkey: "pk" as string | null };
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ ferryAircraft, pubkey: state.pubkey }),
}));
const confirm = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/shared/lib/useConfirm", () => ({ useConfirm: () => confirm }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { loadPendingAssignments } from "@/features/network/utils/pendingAssignments";
import { useFerryAndAssign } from "./useFerryAndAssign";

const aircraft = { id: "a1", name: "Lisbon One", baseAirportIata: "LIS" } as never;
const route = { id: "r1", originIata: "MAD", destinationIata: "BCN" } as never;

afterEach(() => {
  window.localStorage.clear();
  ferryAircraft.mockReset();
  confirm.mockReset();
  confirm.mockResolvedValue(true);
  toast.success.mockClear();
  toast.error.mockClear();
  state.pubkey = "pk";
});

describe("useFerryAndAssign()", () => {
  it("ferries, queues the assignment and announces it", async () => {
    const onQueue = vi.fn();
    window.addEventListener("acars:pending-assignments", onQueue);
    const { result } = renderHook(() => useFerryAndAssign());
    await expect(result.current(aircraft, route, "MAD", 513)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("513 km") }),
    );
    expect(ferryAircraft).toHaveBeenCalledWith("a1", "MAD");
    expect(loadPendingAssignments("pk")).toEqual([
      { aircraftId: "a1", routeId: "r1", ferryTo: "MAD" },
    ]);
    expect(onQueue).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    window.removeEventListener("acars:pending-assignments", onQueue);
  });

  it("does nothing when cancelled or signed out", async () => {
    confirm.mockResolvedValueOnce(false);
    const { result, rerender } = renderHook(() => useFerryAndAssign());
    await expect(result.current(aircraft, route, "MAD", 513)).resolves.toBe(false);
    state.pubkey = null;
    rerender();
    await expect(result.current(aircraft, route, "MAD", 513)).resolves.toBe(false);
    expect(ferryAircraft).not.toHaveBeenCalled();
  });

  it("queues nothing when the ferry fails", async () => {
    ferryAircraft.mockRejectedValueOnce(new Error("idle only"));
    const { result } = renderHook(() => useFerryAndAssign());
    await expect(result.current(aircraft, route, "MAD", 513)).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't start the ferry", {
      description: "idle only",
    });
    expect(loadPendingAssignments("pk")).toEqual([]);
  });
});
