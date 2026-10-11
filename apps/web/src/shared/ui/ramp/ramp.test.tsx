import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { crowdFigures } from "./crowd";
import { PaxCrowd } from "./PaxCrowd";
import { Sign } from "./Sign";
import { Slab } from "./Slab";

afterEach(cleanup);

describe("Sign", () => {
  it("renders each variant with its text and puts the arrow on its side", () => {
    render(
      <>
        <Sign variant="location">Hangar</Sign>
        <Sign variant="direction" arrow="right">
          Lines
        </Sign>
        <Sign variant="mandatory">Hold</Sign>
      </>,
    );
    expect(screen.getByText("Hangar").closest("[data-sign]")).toHaveAttribute(
      "data-sign",
      "location",
    );
    const direction = screen.getByText("Lines").closest("[data-sign]");
    expect(direction).toHaveAttribute("data-sign", "direction");
    expect(direction?.lastElementChild).toHaveTextContent("▶");
    expect(direction?.lastElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Hold").closest("[data-sign]")).toHaveClass("bg-sign-red");
  });
});

describe("Slab", () => {
  it("paints an edge only when asked", () => {
    render(
      <>
        <Slab data-testid="plain">a</Slab>
        <Slab data-testid="idle" edge="idle">
          b
        </Slab>
      </>,
    );
    expect(screen.getByTestId("plain")).toHaveClass("ramp-slab");
    expect(screen.getByTestId("plain").getAttribute("style")).toBeNull();
    expect(screen.getByTestId("idle").style.boxShadow).toContain("--hi-vis");
  });
});

describe("PaxCrowd", () => {
  const segments = [
    { count: 412, tone: "paint" as const, label: "boarded" },
    { count: 28, tone: "caution" as const, label: "stayed behind" },
    { count: 0, tone: "normal" as const, label: "connected" },
  ];

  it("draws one figure per ten people, never hiding a small group", () => {
    expect(crowdFigures(segments)).toEqual([
      { tone: "paint", figures: 42 },
      { tone: "caution", figures: 3 },
      { tone: "normal", figures: 0 },
    ]);
    expect(crowdFigures([{ count: 1, tone: "caution", label: "x" }])[0].figures).toBe(1);
  });

  it("caps the crowd and is deterministic", () => {
    const big = [
      { count: 5000, tone: "paint" as const, label: "a" },
      { count: 30, tone: "caution" as const, label: "b" },
    ];
    const once = crowdFigures(big, 10, 60);
    expect(once.reduce((n, g) => n + g.figures, 0)).toBeLessThanOrEqual(60);
    expect(once[1].figures).toBeGreaterThanOrEqual(1);
    expect(crowdFigures(big, 10, 60)).toEqual(once);
  });

  it("speaks the groups, not the figures", () => {
    render(<PaxCrowd segments={segments} />);
    const crowd = screen.getByRole("img", { name: "412 boarded, 28 stayed behind" });
    expect(crowd.querySelectorAll("svg")).toHaveLength(45);
  });
});
