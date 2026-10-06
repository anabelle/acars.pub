/**
 * Small route map (S50): airports and route lines projected (equirectangular)
 * into a box, fitted to the network with padding and kept to scale.
 * Dependency-free so the OG-image function can reuse it.
 */

export interface MapAirport {
  iata: string;
  latitude: number;
  longitude: number;
}

export interface MapRoute {
  originIata: string;
  destinationIata: string;
}

export interface RouteMapGeometry {
  width: number;
  height: number;
  points: Array<{ iata: string; x: number; y: number; hub: boolean }>;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

/** Below this span (degrees) the map zooms out so one short route isn't a dot. */
const MIN_SPAN_DEGREES = 8;

export function projectRouteMap(
  routes: readonly MapRoute[],
  airportByIata: (iata: string) => MapAirport | undefined,
  {
    width,
    height,
    padding,
    hubs = [],
  }: { width: number; height: number; padding: number; hubs?: readonly string[] },
): RouteMapGeometry {
  const used = new Map<string, MapAirport>();
  const pairs: Array<[MapAirport, MapAirport]> = [];
  for (const route of routes) {
    const a = airportByIata(route.originIata);
    const b = airportByIata(route.destinationIata);
    if (!a || !b) continue;
    used.set(a.iata, a);
    used.set(b.iata, b);
    pairs.push([a, b]);
  }
  for (const hub of hubs) {
    const airport = airportByIata(hub);
    if (airport) used.set(airport.iata, airport);
  }
  if (used.size === 0) return { width, height, points: [], lines: [] };

  const airports = [...used.values()];
  let minLon = Math.min(...airports.map((a) => a.longitude));
  let maxLon = Math.max(...airports.map((a) => a.longitude));
  let minLat = Math.min(...airports.map((a) => a.latitude));
  let maxLat = Math.max(...airports.map((a) => a.latitude));
  const lonPad = Math.max(0, (MIN_SPAN_DEGREES - (maxLon - minLon)) / 2);
  const latPad = Math.max(0, (MIN_SPAN_DEGREES - (maxLat - minLat)) / 2);
  minLon -= lonPad;
  maxLon += lonPad;
  minLat -= latPad;
  maxLat += latPad;

  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(innerW / (maxLon - minLon), innerH / (maxLat - minLat));
  const offsetX = padding + (innerW - (maxLon - minLon) * scale) / 2;
  const offsetY = padding + (innerH - (maxLat - minLat) * scale) / 2;
  const project = (a: MapAirport) => ({
    x: Math.round((offsetX + (a.longitude - minLon) * scale) * 10) / 10,
    y: Math.round((offsetY + (maxLat - a.latitude) * scale) * 10) / 10,
  });

  return {
    width,
    height,
    points: airports
      .map((a) => ({ iata: a.iata, ...project(a), hub: hubs.includes(a.iata) }))
      .sort((p, q) => p.iata.localeCompare(q.iata)),
    lines: pairs.map(([a, b]) => {
      const p = project(a);
      const q = project(b);
      return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
    }),
  };
}
