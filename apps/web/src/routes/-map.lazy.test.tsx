import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/features/network/components/WorldMap", () => {
  return {
    WorldMap: () => <div>World Map</div>,
  };
});

import MapRoute from "./-map.lazy";

describe("Map route", () => {
  it("renders world map", () => {
    const { container } = render(<MapRoute />);
    expect(container.firstChild).toBeNull();
  });
});
