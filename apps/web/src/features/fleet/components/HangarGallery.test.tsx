import { fp, TICKS_PER_HOUR } from "@acars/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

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
const store = vi.hoisted(() => ({ timeline: [] as unknown[], tick: 100_000 }));
const utilization = vi.hoisted(() => ({
  value: {
    blockHours: 12,
    idle: false,
    suggestedFrequency: null as number | null,
    flyMore: vi.fn(),
    saving: false,
  },
}));
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: typeof store) => unknown) => selector(store),
  useEngineStore: (selector: (s: typeof store) => unknown) => selector(store),
}));
vi.mock("./AircraftLiveryImage", () => ({
  AircraftLiveryImage: ({ aircraft }: { aircraft: { liveryImageUrl?: string } }) => (
    <div data-testid="livery-image" data-has-image={String(Boolean(aircraft.liveryImageUrl))} />
  ),
}));
vi.mock("@/features/network/hooks/useRouteUtilization", () => ({
  useRouteUtilization: () => utilization.value,
}));
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
  store.timeline = [];
  utilization.value = {
    blockHours: 12,
    idle: false,
    suggestedFrequency: null,
    flyMore: vi.fn(),
    saving: false,
  };
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
    expect(screen.getAllByTestId("livery-image")[0]).toHaveAttribute("data-has-image", "true");
    fireEvent.click(within(tiles[2]).getByText("Ship 3"));
    expect(navigateToAircraft).toHaveBeenCalledWith("3");
  });

  it("handles an unknown model and no airline", () => {
    render(<HangarGallery fleet={[plane("x", { modelId: "nope" })]} airline={null} routes={[]} />);
    expect(screen.getByTestId("hangar-tile")).toHaveTextContent("Ship x");
  });

  const route = { id: "r1", originIata: "MAD", destinationIata: "BCN" } as never;
  const landing = (aircraftId: string, profit: number) => ({
    id: `l-${aircraftId}`,
    tick: store.tick - TICKS_PER_HOUR,
    timestamp: 0,
    type: "landing",
    description: "",
    aircraftId,
    profit: fp(profit),
    details: { flightDurationTicks: TICKS_PER_HOUR },
  });

  it("signs the top earner and shows each plane's last 24 hours (S60)", () => {
    store.timeline = [landing("1", 1_000), landing("2", 9_000)];
    render(
      <HangarGallery
        fleet={[plane("1", { assignedRouteId: "r1" }), plane("2", { assignedRouteId: "r1" })]}
        airline={{ name: "TestAir", livery: { primary: "#C061CB" } } as never}
        routes={[route]}
      />,
    );
    const [first, second] = screen.getAllByTestId("hangar-tile");
    expect(second).toHaveAttribute("data-state", "top-earner");
    expect(second).toHaveTextContent("Top earner");
    expect(second).toHaveTextContent("$9,000 / 7 d");
    expect(first).toHaveAttribute("data-state", "normal");
    expect(first).toHaveTextContent("Stand 1");
    expect(within(first).getByRole("img", { name: "1.0 block h / 24 h" })).toBeInTheDocument();
  });

  it("puts a parked plane to work in one tap", () => {
    render(<HangarGallery fleet={[plane("p")]} airline={null} routes={[]} />);
    expect(screen.getByTestId("hangar-tile")).toHaveAttribute("data-state", "idle");
    fireEvent.click(screen.getByTestId("hangar-put-to-work"));
    expect(navigateToAircraft).toHaveBeenCalledWith("p");
  });

  it("flies an underused plane more in one tap", () => {
    const flyMore = vi.fn();
    utilization.value = {
      blockHours: 2,
      idle: true,
      suggestedFrequency: 46,
      flyMore,
      saving: false,
    };
    render(
      <HangarGallery
        fleet={[plane("u", { assignedRouteId: "r1" })]}
        airline={null}
        routes={[route]}
      />,
    );
    expect(screen.getByTestId("hangar-tile")).toHaveAttribute("data-state", "idle");
    fireEvent.click(screen.getByTestId("hangar-fly-more"));
    expect(screen.getByTestId("hangar-fly-more")).toHaveTextContent("Fly more · 46/wk");
    expect(flyMore).toHaveBeenCalled();
  });
});
