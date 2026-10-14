import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// public/maplibre/ ships maplibre's worker modules verbatim (see WorldMap.tsx).
// After a maplibre-gl bump, recopy them:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-{worker,shared}.mjs public/maplibre/
const dist = join(
  dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
  "dist",
);
const publicDir = join(__dirname, "../../../../public/maplibre");

describe("public/maplibre worker copies", () => {
  it.each(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])(
    "%s matches the installed maplibre-gl",
    (file) => {
      const shipped = readFileSync(join(publicDir, file), "utf8");
      const installed = readFileSync(join(dist, file), "utf8");
      expect(shipped === installed, `${file} is stale: recopy it from ${dist}`).toBe(true);
    },
  );
});
