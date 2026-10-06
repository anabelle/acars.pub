import type { Route } from "@acars/core";
import { fp } from "@acars/core";
import { describe, expect, it } from "vitest";
import { toMapRoutes } from "./mapRoutes";

const route = (id: string, patch: Partial<Route> = {}) =>
  ({
    id,
    originIata: "MAD",
    destinationIata: id,
    airlinePubkey: "me",
    status: "active",
    frequencyPerWeek: 7,
    ...patch,
  }) as Route;

describe("toMapRoutes", () => {
  it("maps active routes with their measured profit per hour", () => {
    expect(
      toMapRoutes(
        [
          route("BCN"),
          route("LIS", { frequencyPerWeek: 14 }),
          route("OPO", { status: "suspended" }),
        ],
        [{ routeId: "BCN", profitPerHour: fp(1250) }],
      ),
    ).toEqual([
      {
        originIata: "MAD",
        destinationIata: "BCN",
        ownerPubkey: "me",
        isPlayer: true,
        frequencyPerWeek: 7,
        profitPerHour: 1250,
      },
      {
        originIata: "MAD",
        destinationIata: "LIS",
        ownerPubkey: "me",
        isPlayer: true,
        frequencyPerWeek: 14,
        profitPerHour: null,
      },
    ]);
  });
});
