import type * as maplibregl from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { shimMapTransform } from "./mapCompat";

describe("shimMapTransform()", () => {
  it("exposes the camera's transform as map.transform (MapLibre v6)", () => {
    const transform = { height: 900 };
    const map = { _camera: { transform } } as unknown as maplibregl.Map;
    shimMapTransform(map);
    expect((map as unknown as { transform: unknown }).transform).toBe(transform);
  });

  it("leaves maps that already have a transform alone", () => {
    const own = { height: 1 };
    const map = {
      transform: own,
      _camera: { transform: { height: 2 } },
    } as unknown as maplibregl.Map;
    shimMapTransform(map);
    expect((map as unknown as { transform: unknown }).transform).toBe(own);
  });
});
