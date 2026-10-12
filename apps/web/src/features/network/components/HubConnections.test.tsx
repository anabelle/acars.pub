import type { Route } from "@acars/core";
import { fp, TICKS_PER_DAY } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const route = (id: string, o: string, d: string): Route =>
  ({
    id,
    originIata: o,
    destinationIata: d,
    distanceKm: 500,
    airlinePubkey: "me",
    assignedAircraftIds: [],
    fareEconomy: fp(150),
    fareBusiness: fp(450),
    fareFirst: fp(800),
    status: "active",
  }) as Route;
const state = { routes: [route("r1", "MAD", "LIS"), route("r2", "MAD", "BCN")], fleet: [] };
vi.mock("@acars/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@acars/store")>()),
  useAirlineStore: (selector: (s: typeof state) => unknown) => selector(state),
  useEngineStore: (selector: (s: { tick: number }) => unknown) =>
    selector({ tick: 600 * TICKS_PER_DAY }),
}));

import { HubConnections } from "./HubConnections";

beforeAll(() => setAirportsCatalog(airports));
afterEach(cleanup);

describe("HubConnections (S67)", () => {
  it("shows people a day connecting through the hub, the flows and a timing tip", () => {
    render(<HubConnections iata="MAD" />);
    expect(screen.getByTestId("hub-connections")).toHaveTextContent(/connect through MAD/);
    expect(screen.getByTestId("hub-connection-pairs")).toHaveTextContent(/LIS→BCN|BCN→LIS/);
    expect(screen.getByText(/45 min – 3 h before departures/)).toBeInTheDocument();
  });

  it("stays silent at an airport that is not a connecting hub", () => {
    render(<HubConnections iata="LIS" />);
    expect(screen.queryByTestId("hub-connections")).toBeNull();
  });
});
