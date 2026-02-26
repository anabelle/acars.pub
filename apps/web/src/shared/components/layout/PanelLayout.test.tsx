import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelLayout } from "./PanelLayout";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => {
  return {
    useNavigate: () => mockNavigate,
  };
});

describe("PanelLayout", () => {
  it("renders children and calls navigate on close", () => {
    render(
      <PanelLayout>
        <div>Panel content</div>
      </PanelLayout>,
    );

    expect(screen.getByText("Panel content")).toBeInTheDocument();

    const button = screen.getByTitle("Close Panel (View Map)");
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/map" });
  });
});
