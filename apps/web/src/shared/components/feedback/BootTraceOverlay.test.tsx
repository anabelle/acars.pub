import { bootMark, resetBootTrace } from "@acars/store";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BootTraceOverlay } from "./BootTraceOverlay";

describe("BootTraceOverlay", () => {
  beforeEach(() => {
    resetBootTrace();
    sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("stays hidden unless ?boot=1 was asked for", () => {
    render(<BootTraceOverlay />);
    expect(screen.queryByTestId("boot-trace")).not.toBeInTheDocument();
  });

  it("lists the stages as they happen", () => {
    window.history.replaceState({}, "", "/?boot=1");
    bootMark("identity: start");
    render(<BootTraceOverlay />);
    const panel = screen.getByTestId("boot-trace");
    expect(panel).toHaveTextContent("identity: start");
    expect(panel).toHaveTextContent("long tasks:");
    act(() => bootMark("world: synced", "2 rivals"));
    expect(panel).toHaveTextContent("world: synced (2 rivals)");
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
