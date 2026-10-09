import { fp, TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore } from "@acars/store";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
    if (search) href += `?${new URLSearchParams(search)}`;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

import { RouteMapCard } from "./RouteMapCard";

const initial = useAirlineStore.getState();
const mine = {
  id: "r-mine",
  originIata: "MAD",
  destinationIata: "BCN",
  airlinePubkey: "me",
  distanceKm: 483.4,
  frequencyPerWeek: 14,
  assignedAircraftIds: ["a1"],
  fareEconomy: fp(100),
  fareBusiness: fp(200),
  fareFirst: fp(300),
  status: "active",
};
const theirs = { ...mine, id: "r-theirs", airlinePubkey: "rival", frequencyPerWeek: 7 };
const landing = {
  id: "l1",
  tick: 10,
  timestamp: 0,
  type: "landing",
  description: "",
  profit: fp(4_000),
  details: { routeId: "r-mine", loadFactor: 0.82, flightDurationTicks: TICKS_PER_HOUR },
};

beforeEach(() => {
  useAirlineStore.setState({
    routes: [mine],
    timeline: [],
    routesByOwner: new Map([["rival", [theirs]]]),
    competitors: new Map([["rival", { name: "Vueling Rival" }]]),
  } as never);
});

afterEach(async () => {
  cleanup();
  useAirlineStore.setState(initial, true);
  await i18n.changeLanguage("en");
});

const select = (isPlayer: boolean) => ({
  routeId: isPlayer ? "r-mine" : "r-theirs",
  originIata: "MAD",
  destinationIata: "BCN",
  ownerPubkey: isPlayer ? "me" : "rival",
  isPlayer,
});

describe("RouteMapCard", () => {
  it("shows your route's schedule and, once it has flown, how it earns", () => {
    const { unmount } = render(<RouteMapCard selection={select(true)} onClose={() => {}} />);
    const card = screen.getByTestId("route-card");
    expect(card).toHaveAttribute("data-owner", "player");
    expect(card).toHaveTextContent("MAD ⇄ BCN");
    expect(screen.getByTestId("route-card-owner")).toHaveTextContent("Your route");
    expect(screen.getByTestId("route-card-frequency")).toHaveTextContent("14×");
    expect(card).toHaveTextContent("483 km");
    expect(screen.getByTestId("route-card-profit")).toHaveTextContent("—");
    expect(card).toHaveTextContent("No landings yet");
    expect(screen.getByRole("link", { name: "Fares & frequency" })).toHaveAttribute(
      "href",
      "/network?tab=active",
    );
    unmount();

    useAirlineStore.setState({ timeline: [landing] } as never);
    render(<RouteMapCard selection={select(true)} onClose={() => {}} />);
    expect(screen.getByTestId("route-card-profit")).toHaveTextContent("$4,000");
    expect(screen.getByTestId("route-card")).toHaveTextContent("82%");
    expect(screen.queryByText(/No landings yet/)).not.toBeInTheDocument();
  });

  it("names a rival's route by its airline, without your economics", () => {
    render(<RouteMapCard selection={select(false)} onClose={() => {}} />);
    expect(screen.getByTestId("route-card")).toHaveAttribute("data-owner", "rival");
    expect(screen.getByTestId("route-card-owner")).toHaveTextContent("Vueling Rival");
    expect(screen.getByTestId("route-card-frequency")).toHaveTextContent("7×");
    expect(screen.queryByTestId("route-card-profit")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fares & frequency" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open BCN" })).toHaveAttribute("href", "/airport/BCN");
  });

  it("falls back gracefully for an unknown rival and closes on X, Escape or a door", () => {
    const onClose = vi.fn();
    render(
      <RouteMapCard
        selection={{ ...select(false), ownerPubkey: "ghost", routeId: "gone" }}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("route-card-owner")).toHaveTextContent("A rival airline");
    expect(screen.getByTestId("route-card-frequency")).toHaveTextContent("—");
    fireEvent.click(screen.getByRole("button", { name: "Close the route card" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("link", { name: "Open MAD" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("renders in Spanish", async () => {
    await i18n.changeLanguage("es");
    render(<RouteMapCard selection={select(true)} onClose={() => {}} />);
    expect(screen.getByText("Tu ruta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tarifas y frecuencia" })).toBeInTheDocument();
  });
});
