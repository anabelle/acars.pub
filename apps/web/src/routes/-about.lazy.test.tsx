import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("@/shared/components/layout/PanelLayout", () => {
  return {
    PanelLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PanelHeader: ({ title }: { title: string }) => <div>{title}</div>,
    PanelBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/shared/components/layout/panelScrollContext", () => ({
  usePanelScrollRef: () => ({ current: null }),
}));

import AboutPage from "./-about.lazy";

describe("About route", () => {
  it("renders about panel", () => {
    render(<AboutPage />);
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("has a link to GitHub", () => {
    render(<AboutPage />);
    const githubLink = screen.getByText("View on GitHub").closest("a");
    expect(githubLink).toHaveAttribute("href", "https://github.com/anabelle/acars.pub");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has a link to learn about Nostr", () => {
    render(<AboutPage />);
    const nostrLink = screen.getByText("Learn about Nostr").closest("a");
    expect(nostrLink).toHaveAttribute("href", "https://nostr.com");
  });

  it("renders highlight cards", () => {
    render(<AboutPage />);
    expect(screen.getByText("Decentralized on Nostr")).toBeInTheDocument();
    expect(screen.getByText("Real-Time Aviation Sim")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin & Lightning")).toBeInTheDocument();
  });
});
