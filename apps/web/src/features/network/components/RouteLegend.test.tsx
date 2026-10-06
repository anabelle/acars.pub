import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { RouteLegend } from "./RouteLegend";

afterEach(cleanup);

describe("RouteLegend", () => {
  it("explains colour as profit and width as frequency", () => {
    render(<RouteLegend showWorld onShowWorldChange={() => {}} />);
    const legend = screen.getByTestId("route-legend");
    expect(legend).toHaveTextContent("Your routes");
    expect(legend).toHaveTextContent("Losing");
    expect(legend).toHaveTextContent("Earning");
    expect(legend).toHaveTextContent("Thicker = more flights a week");
  });

  it("switches between my network and the world", () => {
    const onChange = vi.fn();
    render(<RouteLegend showWorld onShowWorldChange={onChange} />);
    expect(screen.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "My network" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
