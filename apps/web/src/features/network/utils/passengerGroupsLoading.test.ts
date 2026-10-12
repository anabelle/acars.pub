import { groupMix } from "@acars/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("@acars/data", () => ({
  getAirports: () => {
    throw new Error("airports catalog not loaded yet");
  },
}));

import { destinationMix } from "./passengerGroups";

describe("destination mix before the catalog loads (S71)", () => {
  it("counts everyone as the general mix", () => {
    expect(destinationMix("TFS")).toEqual(groupMix("general"));
  });
});
