import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { FleetPosterDialog } from "./FleetPosterDialog";

const airline = {
  name: "Test Air",
  icaoCode: "TST",
  tier: 2,
  livery: { primary: "#112233", secondary: "#ffffff", accent: "#ffcc00" },
} as never;
const fleet = [
  { id: "a1", name: "Ship 1", liveryImageUrl: null },
  { id: "a2", name: "Ship 2", liveryImageUrl: null },
] as never;
const routes = [
  { id: "r1", status: "active" },
  { id: "r2", status: "suspended" },
] as never;

const texts: string[] = [];
let toBlob: (cb: (blob: Blob | null) => void) => void;

beforeEach(() => {
  texts.length = 0;
  toBlob = (cb) => cb(new Blob(["png"], { type: "image/png" }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        fillRect: () => {},
        fillText: (text: string) => texts.push(text),
        drawImage: () => {},
        save: () => {},
        restore: () => {},
      }) as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb) {
    toBlob(cb as never);
  });
  URL.createObjectURL = vi.fn(() => "blob:poster");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toast.error.mockClear();
});

describe("FleetPosterDialog", () => {
  it("draws the poster with the airline's stats and switches size", async () => {
    render(
      <FleetPosterDialog airline={airline} fleet={fleet} routes={routes} onClose={() => {}} />,
    );
    const canvas = screen.getByTestId("fleet-poster-canvas") as HTMLCanvasElement;
    await waitFor(() => expect(canvas).toHaveAttribute("data-ready", "true"));
    expect([canvas.width, canvas.height]).toEqual([1080, 1350]);
    expect(texts).toEqual(
      expect.arrayContaining(["Test Air", "TST", "2", "1", "AIRCRAFT", "ROUTES", "TIER"]),
    );

    fireEvent.click(screen.getByRole("button", { name: /landscape/i }));
    await waitFor(() => expect(canvas.width).toBe(1200));
    expect(canvas.height).toBe(630);
  });

  it("downloads a PNG named after the airline", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <FleetPosterDialog airline={airline} fleet={fleet} routes={routes} onClose={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "Download PNG" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(click).toHaveBeenCalled();
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
      "test-air-fleet-1080x1350.png",
    );
  });

  it("reports an export failure (tainted canvas or empty blob)", async () => {
    render(
      <FleetPosterDialog airline={airline} fleet={fleet} routes={routes} onClose={() => {}} />,
    );
    const button = screen.getByRole("button", { name: "Download PNG" });
    await waitFor(() => expect(button).toBeEnabled());
    toBlob = (cb) => cb(null);
    fireEvent.click(button);
    expect(toast.error).toHaveBeenCalledWith("Couldn't create the poster");
    toBlob = () => {
      throw new Error("tainted");
    };
    fireEvent.click(button);
    expect(toast.error).toHaveBeenCalledWith("Couldn't create the poster", {
      description: "tainted",
    });
  });

  it("closes from the backdrop", () => {
    const onClose = vi.fn();
    render(<FleetPosterDialog airline={airline} fleet={fleet} routes={routes} onClose={onClose} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
