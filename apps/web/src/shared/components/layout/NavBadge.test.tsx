import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NavBadge } from "./NavBadge";

afterEach(cleanup);

describe("NavBadge", () => {
  it("shows a count, capped, and nothing at zero", () => {
    const { container, rerender } = render(<NavBadge count={3} variant="red" />);
    expect(screen.getByLabelText("3 notifications")).toHaveTextContent("3");
    rerender(<NavBadge count={120} variant="gray" />);
    expect(screen.getByLabelText("120 notifications")).toHaveTextContent("99+");
    rerender(<NavBadge count={0} variant="gray" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a rank as a rank", () => {
    render(<NavBadge count={4} variant="gray" prefix="#" />);
    expect(screen.getByLabelText("#4")).toHaveTextContent("#4");
  });
});
