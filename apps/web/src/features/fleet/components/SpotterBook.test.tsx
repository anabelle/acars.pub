import { aircraftModels } from "@acars/data";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { SpotterBook } from "./SpotterBook";

vi.mock("./CatalogImage", () => ({ CatalogImage: () => <div data-testid="catalog-image" /> }));
vi.mock("./AircraftLiveryImage", () => ({
  AircraftLiveryImage: () => <div data-testid="own-painting" />,
}));
vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (s: { airline: null }) => unknown) => selector({ airline: null }),
}));

afterEach(cleanup);

describe("SpotterBook (S61)", () => {
  it("shows the collection's progress and each type's state", () => {
    render(<SpotterBook fleet={[{ id: "a", modelId: "atr72-600" } as never]} tier={1} />);
    expect(screen.getByTestId("spotter-progress")).toHaveTextContent(
      `1 / ${aircraftModels.length} types`,
    );
    const cards = screen.getAllByTestId("spotter-card");
    expect(cards).toHaveLength(aircraftModels.length);
    expect(cards[0]).toHaveAttribute("data-state", "owned");
    expect(cards[0]).toHaveTextContent("×1");
    expect(cards[0]).toHaveTextContent("In your fleet");
    expect(cards[0].querySelector("[data-testid=own-painting]")).not.toBeNull();
    const locked = cards.filter((card) => card.getAttribute("data-state") === "locked");
    expect(locked.length).toBeGreaterThan(0);
    expect(locked[0]).toHaveTextContent(/Tier \d/);
  });
});
