import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapView from "./-index.lazy";

describe("MapView", () => {
  it("renders nothing (full map background shows through)", () => {
    const { container } = render(<MapView />);
    expect(container.firstChild).toBeNull();
  });
});
