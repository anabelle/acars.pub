import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapView from "./-index.lazy";

const LIVE_WORLD_DISMISSED_UNTIL_KEY = "acars:home:live-world:dismissed-until";
const mockUseSearch = vi.fn();
const mockUseActiveAirline = vi.fn();
const localStorageState = new Map<string, string>();

function createMockStorage(state: Map<string, string>) {
  return {
    getItem: vi.fn((key: string) => state.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      state.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      state.delete(key);
    }),
    clear: vi.fn(() => {
      state.clear();
    }),
  };
}

vi.mock("@acars/store", () => ({
  useActiveAirline: () => mockUseActiveAirline(),
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mockUseSearch(),
  Link: ({
    children,
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => {
    const href = search ? `${to}?${new URLSearchParams(search).toString()}` : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/features/briefing/HomeBriefing", () => ({
  HomeBriefing: ({ startCollapsed }: { startCollapsed?: boolean }) => (
    <div data-testid="home-briefing" data-start-collapsed={String(Boolean(startCollapsed))} />
  ),
}));

vi.mock("@/features/cockpit/components/OperationsCockpit", () => ({
  OperationsCockpit: () => <div>Operations Cockpit</div>,
}));

describe("MapView", () => {
  beforeEach(() => {
    localStorageState.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: createMockStorage(localStorageState),
      configurable: true,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T15:10:38.598Z"));
  });

  afterEach(() => {
    cleanup();
    mockUseActiveAirline.mockReset();
    mockUseSearch.mockReset();
    localStorageState.clear();
    vi.useRealTimers();
  });

  it("renders the map-first home card by default", () => {
    mockUseActiveAirline.mockReturnValue({ airline: null });
    mockUseSearch.mockReturnValue({ panel: undefined });
    render(<MapView />);
    // Guests get one call to action: start an airline (overhaul S20.5).
    expect(screen.getByText("Watch the world fly")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start your airline/i })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.queryByRole("link", { name: /open operator cockpit/i })).not.toBeInTheDocument();
  });

  it("renders the operations cockpit when requested", () => {
    mockUseActiveAirline.mockReturnValue({ airline: null });
    mockUseSearch.mockReturnValue({ panel: "cockpit" });
    render(<MapView />);
    expect(screen.getByText("Operations Cockpit")).toBeInTheDocument();
  });

  it("keeps the cockpit mounted but hidden when map panel is requested", () => {
    mockUseActiveAirline.mockReturnValue({ airline: null });
    mockUseSearch.mockReturnValue({ panel: "map" });
    const { container } = render(<MapView />);
    // The cockpit wrapper stays mounted (state/memos survive) but is hidden.
    expect(container.firstChild).not.toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain("hidden");
    expect(screen.queryByText("Watch the world fly")).not.toBeInTheDocument();
  });

  it("shows the briefing for an airline, folded on the map-only view, never over the cockpit", () => {
    mockUseActiveAirline.mockReturnValue({ airline: { name: "Avianca" } });
    mockUseSearch.mockReturnValue({ panel: undefined });
    const { unmount } = render(<MapView />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-start-collapsed", "false");
    expect(screen.queryByText("Watch the world fly")).not.toBeInTheDocument();
    unmount();

    mockUseSearch.mockReturnValue({ panel: "map" });
    const map = render(<MapView />);
    expect(screen.getByTestId("home-briefing")).toHaveAttribute("data-start-collapsed", "true");
    map.unmount();

    // The cockpit carries the same cards: the briefing steps aside.
    mockUseSearch.mockReturnValue({ panel: "cockpit" });
    render(<MapView />);
    expect(screen.queryByTestId("home-briefing")).not.toBeInTheDocument();
  });

  it("persists dismissal for 15 days and hides the intro after closing it", () => {
    mockUseActiveAirline.mockReturnValue({ airline: null });
    mockUseSearch.mockReturnValue({ panel: undefined });

    render(<MapView />);
    expect(screen.getByText("Watch the world fly")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close panel and return to cockpit/i }));

    expect(screen.queryByText("Watch the world fly")).not.toBeInTheDocument();
    expect(localStorage.getItem(LIVE_WORLD_DISMISSED_UNTIL_KEY)).toBe(
      String(Date.now() + 1000 * 60 * 60 * 24 * 15),
    );
  });

  it("stays hidden while the dismissal window is still active", () => {
    mockUseActiveAirline.mockReturnValue({ airline: null });
    mockUseSearch.mockReturnValue({ panel: undefined });
    localStorage.setItem(LIVE_WORLD_DISMISSED_UNTIL_KEY, String(Date.now() + 1000 * 60 * 60 * 24));

    const { container } = render(<MapView />);

    // Intro card hidden; cockpit remains mounted-but-hidden.
    expect(screen.queryByText("Watch the world fly")).not.toBeInTheDocument();
    expect(container.firstChild).not.toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain("hidden");
  });
});
