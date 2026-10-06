import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveryThumb } from "./LiveryThumb";

afterEach(cleanup);

describe("LiveryThumb", () => {
  it("shows the livery image when there is one", () => {
    render(<LiveryThumb imageUrl="https://img/x.png" familyId="atr" alt="TestAir ATR 72" />);
    expect(screen.getByRole("img", { name: "TestAir ATR 72" })).toHaveAttribute(
      "src",
      "https://img/x.png",
    );
    expect(screen.getByTestId("livery-thumb")).toHaveAttribute("data-has-image", "true");
  });

  it("falls back to the tinted silhouette without an image or when it fails", () => {
    const { rerender } = render(
      <LiveryThumb familyId="atr" color="#ff0000" alt="no image" size="xs" />,
    );
    expect(screen.getByTestId("livery-thumb")).toHaveAttribute("data-has-image", "false");
    expect(screen.getByTitle("no image")).toHaveStyle({
      backgroundColor: "rgba(255, 0, 0, 0.3)",
    });
    rerender(<LiveryThumb familyId="atr" color="red" alt="named colour" />);
    expect(screen.getByTitle("named colour").style.backgroundColor).toBe("red");

    rerender(<LiveryThumb imageUrl="https://img/broken.png" alt="broken" size="md" />);
    fireEvent.error(screen.getByRole("img", { name: "broken" }));
    expect(screen.getByTestId("livery-thumb")).toHaveAttribute("data-has-image", "false");
  });
});
