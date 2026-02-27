import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("@acars/store", () => {
  return {
    useAirlineStore: (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { airline: null, viewedPubkey: null };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock("@tanstack/react-router", () => {
  return {
    Link: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

describe("Sidebar", () => {
  it("renders navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Fleet")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Corporate")).toBeInTheDocument();
  });
});
