import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { RouteLegend } from "./RouteLegend";

describe("RouteLegend", () => {
  it("explains colour as profit and width as frequency", () => {
    render(<RouteLegend />);
    const legend = screen.getByTestId("route-legend");
    expect(legend).toHaveTextContent("Your routes");
    expect(legend).toHaveTextContent("Losing");
    expect(legend).toHaveTextContent("Earning");
    expect(legend).toHaveTextContent("Thicker = more flights a week");
  });
});
