import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { BANDS, type Instrument } from "../utils/instruments";
import { InstrumentPanel } from "./InstrumentPanel";

afterEach(cleanup);

const instrument = (over: Partial<Instrument> & Pick<Instrument, "id">): Instrument => ({
  value: null,
  previous: null,
  band: BANDS[over.id],
  state: "none",
  side: null,
  ...over,
});

describe("InstrumentPanel (S62)", () => {
  it("reads each instrument with its band and trend, and offers a fix out of band", () => {
    const flyMore = vi.fn();
    render(
      <InstrumentPanel
        instruments={[
          instrument({ id: "utilization", value: 3.2, previous: 2, state: "warning", side: "low" }),
          instrument({ id: "loadFactor", value: 0.84, previous: 0.9, state: "normal" }),
          instrument({ id: "margin", value: 0.15, state: "normal" }),
          instrument({ id: "runway", value: Number.POSITIVE_INFINITY, state: "normal" }),
        ]}
        fixes={{
          utilization: { label: "Fly more", run: flyMore },
          margin: { label: "x", run: vi.fn() },
        }}
      />,
    );
    const utilization = screen.getByTestId("instrument-utilization");
    expect(utilization).toHaveTextContent("3.2 h▲");
    expect(utilization).toHaveTextContent("Target 8–13 h a day per plane");
    expect(utilization).toHaveAttribute("data-state", "warning");
    expect(screen.getByTestId("instrument-loadFactor")).toHaveTextContent("84%▼");
    expect(screen.getByTestId("instrument-runway")).toHaveTextContent("Growing");
    // In band: no fix even when one exists.
    expect(screen.queryByTestId("instrument-fix-margin")).toBeNull();
    fireEvent.click(screen.getByTestId("instrument-fix-utilization"));
    expect(flyMore).toHaveBeenCalled();
  });

  it("says so when there is nothing to read yet", () => {
    render(<InstrumentPanel instruments={[instrument({ id: "margin" })]} fixes={{}} />);
    expect(screen.getByTestId("instrument-margin")).toHaveTextContent("—");
    expect(screen.getByTestId("instrument-margin")).toHaveTextContent(
      "No flights in the last 24 h",
    );
  });
});
