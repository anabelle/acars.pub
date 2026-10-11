import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AlertList } from "./AlertList";
import { sortAlerts } from "./alerts";
import { DayStrip } from "./DayStrip";
import { clipDay } from "./day";
import { Readout } from "./Readout";

afterEach(cleanup);

describe("Readout", () => {
  it("shows a label, a value and a unit in the tone's colour", () => {
    render(<Readout label="Block" value="12.4" unit="h" tone="normal" />);
    expect(screen.getByText("Block")).toBeInTheDocument();
    const value = screen.getByText("12.4");
    expect(value).toHaveClass("text-nd-green");
    expect(value).toHaveTextContent("12.4h");
  });
});

describe("AlertList", () => {
  const alerts = [
    { id: "a", level: "normal" as const, text: "LANDED 12:02Z" },
    { id: "b", level: "caution" as const, text: "KDFW TSRA HOLD 18 MIN" },
    { id: "c", level: "warning" as const, text: "MAINTENANCE OVERDUE" },
    { id: "d", level: "caution" as const, text: "SJO SOLD OUT" },
  ];

  it("orders warnings, then cautions, keeping order within a level", () => {
    expect(sortAlerts(alerts).map((a) => a.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("renders one coloured line per alert and nothing when empty", () => {
    const { rerender, container } = render(<AlertList alerts={alerts} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("text-nd-red");
    expect(items[1]).toHaveClass("text-nd-amber");
    expect(items[3]).toHaveClass("text-nd-green");
    rerender(<AlertList alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DayStrip", () => {
  it("clips legs to the day and sums block hours", () => {
    expect(
      clipDay([
        { startHour: 6, durationHours: 2 },
        { startHour: 23, durationHours: 3 },
        { startHour: -1, durationHours: 0.5 },
      ]),
    ).toEqual({
      legs: [
        { startHour: 6, durationHours: 2 },
        { startHour: 23, durationHours: 1 },
      ],
      blockHours: 3,
    });
  });

  it("places legs on a 24-hour track and labels the total", () => {
    render(<DayStrip legs={[{ startHour: 12, durationHours: 6 }]} colour="#C061CB" />);
    expect(screen.getByRole("img", { name: "6.0 block hours today" })).toBeInTheDocument();
    const leg = screen.getByTestId("day-leg");
    expect(leg.style.left).toBe("50%");
    expect(leg.style.width).toBe("25%");
  });
});
