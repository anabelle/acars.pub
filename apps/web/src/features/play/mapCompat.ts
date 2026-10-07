import type * as maplibregl from "maplibre-gl";

/**
 * deck.gl 9.4 reads `map.transform` (height, near/far planes), which MapLibre
 * v6 moved to `map._camera.transform` when Map stopped extending Camera.
 * Until deck.gl supports v6, expose it again. A D4 risk: deck.gl leans on
 * MapLibre internals.
 */
export function shimMapTransform(map: maplibregl.Map): void {
  const target = map as unknown as { transform?: unknown; _camera?: { transform?: unknown } };
  if (target.transform !== undefined || !target._camera) return;
  Object.defineProperty(target, "transform", {
    configurable: true,
    get: () => target._camera?.transform,
  });
}
