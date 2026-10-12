import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { passengerVoice } from "@/features/fleet/utils/cabin";
import { WhoFlies } from "./WhoFlies";

beforeAll(() => {
  setAirportsCatalog(airports);
});
afterEach(cleanup);

describe("WhoFlies (S71)", () => {
  it("shows a beach route as mostly holiday-makers, price-sensitive", () => {
    render(<WhoFlies destinationIata="TFS" />);
    const line = screen.getByTestId("who-flies");
    expect(line).toHaveTextContent(
      "Who flies: 70% holiday-makers · 20% visiting family · 10% business.",
    );
    expect(line).toHaveAttribute("data-tone", "sensitive");
  });

  it("shows a business city as forgiving and anywhere else as middling", () => {
    render(<WhoFlies destinationIata="LHR" />);
    expect(screen.getByTestId("who-flies")).toHaveAttribute("data-tone", "forgiving");
    cleanup();
    render(<WhoFlies destinationIata="PMI" />);
    expect(screen.getByTestId("who-flies")).toHaveAttribute("data-tone", "balanced");
  });
});

describe("group voices (S71)", () => {
  it("lets ordinary flights speak as the groups that fly there", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const key = passengerVoice({
        id: `evt-${i}`,
        tick: 1,
        timestamp: 1,
        type: "landing",
        destinationIata: "TFS",
        description: "",
        details: {
          loadFactor: 0.8,
          passengers: { economy: 80, business: 0, first: 0, total: 80 },
        },
      } as never);
      if (key) keys.add(key);
    }
    expect(keys.has("holiday")).toBe(true);
    expect(keys.has("smooth")).toBe(false);
  });
});
