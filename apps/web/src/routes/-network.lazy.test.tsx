import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/features/network/components/RouteManager", () => {
  return {
    RouteManager: () => <div>Route Manager</div>,
  };
});

import NetworkRoute from "./-network.lazy";

describe("Network route", () => {
  it("renders route manager panel", () => {
    render(<NetworkRoute />);
    expect(screen.getByText("Route Manager")).toBeInTheDocument();
  });
});
