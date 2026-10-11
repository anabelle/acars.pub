import { getAircraftById } from "@acars/data";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { AircraftLiveryImage } from "./AircraftLiveryImage";

const image = vi.hoisted(() => ({
  state: { imageUrl: null as string | null, isGenerating: false, error: null as string | null },
}));
vi.mock("../hooks/useAircraftImage", () => ({ useAircraftImage: () => image.state }));

const model = getAircraftById("atr72-600");
if (!model) throw new Error("atr72-600 missing");

function renderImage() {
  return render(
    <AircraftLiveryImage
      aircraft={{ id: "ac-1" } as never}
      airline={null}
      model={model as NonNullable<typeof model>}
      isOwner
      fallback={<div data-testid="fallback" />}
    />,
  );
}

afterEach(() => {
  cleanup();
  image.state = { imageUrl: null, isGenerating: false, error: null };
});

describe("AircraftLiveryImage (S60)", () => {
  it("shows the painting when there is one", () => {
    image.state = { imageUrl: "blob:painting", isGenerating: false, error: null };
    renderImage();
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:painting");
  });

  it("never prints a generation error, it shows the fallback", () => {
    image.state = { imageUrl: null, isGenerating: false, error: "HTTP 404 (/api/generate-livery)" };
    renderImage();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 404/)).toBeNull();
  });

  it("captions the fallback while the painting is made", () => {
    image.state = { imageUrl: null, isGenerating: true, error: null };
    renderImage();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.getByTestId("livery-painting")).toHaveTextContent("Painting the livery…");
  });
});
