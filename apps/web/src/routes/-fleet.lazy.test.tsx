import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/features/fleet/components/FleetManager", () => {
  return {
    FleetManager: () => <div>Fleet Manager</div>,
  };
});

import FleetRoute from "./-fleet.lazy";

describe("Fleet route", () => {
  it("renders fleet manager panel", () => {
    render(<FleetRoute />);
    expect(screen.getAllByText("Fleet Manager").length).toBeGreaterThan(0);
  });
});
