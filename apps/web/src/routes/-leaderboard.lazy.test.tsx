import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/features/competition/components/Leaderboard", () => {
  return {
    Leaderboard: () => <div>Leaderboard</div>,
  };
});

import LeaderboardRoute from "./-leaderboard.lazy";

describe("Leaderboard route", () => {
  it("renders leaderboard panel", () => {
    render(<LeaderboardRoute />);
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
  });
});
