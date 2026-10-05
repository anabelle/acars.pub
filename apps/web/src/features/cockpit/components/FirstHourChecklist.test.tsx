import { fp, getSuggestedFares } from "@acars/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: { tab: string };
  }) => <a href={search ? `${to}?tab=${search.tab}` : to}>{children}</a>,
}));

import { FirstHourChecklist } from "./FirstHourChecklist";

afterEach(cleanup);

const fares = getSuggestedFares(483);
const route = {
  distanceKm: 483,
  fareEconomy: fares.economy,
  fareBusiness: fares.business,
  fareFirst: fares.first,
  status: "active",
} as never;

describe("FirstHourChecklist", () => {
  it("highlights the next step with a deep link", () => {
    render(<FirstHourChecklist routes={[]} fleet={[]} timeline={[]} cumulativeRevenue={fp(0)} />);
    expect(screen.getByText("0 of 5")).toBeInTheDocument();
    const next = screen.getByTestId("checklist-openRoute");
    expect(within(next).getByRole("link", { name: /find a route/i })).toHaveAttribute(
      "href",
      "/network?tab=opportunities",
    );
    // Only the next step has an action.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("ticks done steps and moves the link along", () => {
    render(
      <FirstHourChecklist routes={[route]} fleet={[]} timeline={[]} cumulativeRevenue={fp(2500)} />,
    );
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
    expect(screen.getByTestId("checklist-firstLanding")).toHaveAttribute("data-done", "true");
    expect(
      within(screen.getByTestId("checklist-adjustFare")).getByRole("link", { name: /edit fares/i }),
    ).toHaveAttribute("href", "/network?tab=active");
  });

  it("disappears once everything is done", () => {
    const priced = { ...(route as object), fareEconomy: fp(1) } as never;
    const { container } = render(
      <FirstHourChecklist
        routes={[priced, route, route]}
        fleet={[]}
        timeline={[]}
        cumulativeRevenue={fp(1)}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
