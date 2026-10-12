import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFollows } from "./useFollows";

describe("useFollows (S74)", () => {
  it("loads once when turned on, and nothing when off or keyless", async () => {
    const load = vi.fn(async () => new Set(["b"]));
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) => useFollows("a", on, load),
      { initialProps: { on: false } },
    );
    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(result.current).toEqual(new Set(["b"])));
    rerender({ on: false });
    rerender({ on: true });
    expect(load).toHaveBeenCalledTimes(1);
    const keyless = renderHook(() => useFollows(null, true, load));
    expect(keyless.result.current).toBeNull();
  });

  it("treats a failed load as following nobody", async () => {
    const load = vi.fn(async () => {
      throw new Error("relays down");
    });
    const { result } = renderHook(() => useFollows("a", true, load));
    await waitFor(() => expect(result.current).toEqual(new Set()));
  });
});
