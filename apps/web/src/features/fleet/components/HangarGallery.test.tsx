import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 196,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 196 })),
  }),
}));
vi.mock("@/shared/components/layout/panelScrollContext", () => ({
  usePanelScrollRef: () => ({ current: null }),
}));
const navigateToAircraft = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/permalinkNavigation", () => ({ navigateToAircraft }));

import { HangarGallery } from "./HangarGallery";

const plane = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: `Ship ${id}`,
    modelId: "atr72-600",
    baseAirportIata: "MAD",
    assignedRouteId: null,
    ...extra,
  }) as never;

afterEach(() => {
  cleanup();
  navigateToAircraft.mockClear();
});

describe("HangarGallery", () => {
  it("renders a tile per aircraft in rows, with route or parking caption", () => {
    render(
      <HangarGallery
        fleet={[
          plane("1", { assignedRouteId: "r1", liveryImageUrl: "https://img/1.png" }),
          plane("2"),
          plane("3"),
        ]}
        airline={{ name: "TestAir", livery: { primary: "#112233" } } as never}
        routes={[{ id: "r1", originIata: "MAD", destinationIata: "BCN" } as never]}
      />,
    );
    const tiles = screen.getAllByTestId("hangar-tile");
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toHaveTextContent("MAD → BCN");
    expect(tiles[1]).toHaveTextContent("Parked at MAD");
    expect(screen.getAllByTestId("livery-thumb")[0]).toHaveAttribute("data-has-image", "true");
    fireEvent.click(tiles[2]);
    expect(navigateToAircraft).toHaveBeenCalledWith("3");
  });

  it("handles an unknown model and no airline", () => {
    render(<HangarGallery fleet={[plane("x", { modelId: "nope" })]} airline={null} routes={[]} />);
    expect(screen.getByTestId("hangar-tile")).toHaveTextContent("Ship x");
  });
});
