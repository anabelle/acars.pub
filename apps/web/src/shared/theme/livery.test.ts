import { describe, expect, it } from "vitest";
import { legibleLiveryColour, modelLabel } from "./livery";
import { ND } from "./tokens";

describe("legibleLiveryColour (S60)", () => {
  it("keeps a bright primary, falls back to the secondary, then to magenta", () => {
    expect(legibleLiveryColour("#C061CB", "#F5C211")).toBe("#C061CB");
    expect(legibleLiveryColour("#1d1957", "#c37d22")).toBe("#c37d22");
    expect(legibleLiveryColour("#1d1957", "#000000")).toBe(ND.magenta);
    expect(legibleLiveryColour(undefined, "not-a-colour")).toBe(ND.magenta);
  });
});

describe("modelLabel", () => {
  it("does not repeat the maker", () => {
    expect(modelLabel("ATR", "ATR 42-600")).toBe("ATR 42-600");
    expect(modelLabel("Airbus", "A320neo")).toBe("Airbus A320neo");
  });
});
