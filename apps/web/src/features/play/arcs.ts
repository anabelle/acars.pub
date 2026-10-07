import type { Airport, Route } from "@acars/core";
import { getGreatCircleInterpolation } from "@acars/map";

/** One route as the deck.gl arc layer draws it. */
export interface RouteArc {
  id: string;
  originIata: string;
  destinationIata: string;
  ownerPubkey: string;
  frequencyPerWeek: number | undefined;
  distanceKm: number;
  /** [longitude, latitude] */
  source: [number, number];
  target: [number, number];
  /** The great circle between them, lifted into an arc: [lng, lat, metres]. */
  path: [number, number, number][];
  /** RGBA, 0–255. */
  color: [number, number, number, number];
  /** Line width in pixels. */
  width: number;
  isPlayer: boolean;
}

/** Rivals stay in the background: dimmer and thinner than the player's network. */
const RIVAL_ALPHA = 90;
const PLAYER_ALPHA = 230;

/** `#rrggbb` (or `#rgb`) to RGB; unreadable colours fall back to a neutral blue. */
export function hexToRgb(hex: string | undefined): [number, number, number] {
  const fallback: [number, number, number] = [96, 165, 250];
  if (!hex) return fallback;
  let digits = hex.trim().replace(/^#/, "");
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  if (!/^[0-9a-f]{6}$/i.test(digits)) return fallback;
  const value = Number.parseInt(digits, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const EARTH_RADIUS_M = 6_371_000;
/** Peak altitude as a share of the route's length: high enough to read as 3D, low enough to stay in frame. */
export const ARC_PEAK_RATIO = 0.08;
export const ARC_SEGMENTS = 32;

/** Great-circle distance in metres (haversine). */
export function greatCircleMeters(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The 3D arc for a route: points along the great circle, raised on a sine
 * curve that peaks mid-route. deck.gl's ArcLayer clipped or dropped arcs on
 * the MapLibre v6 globe, so the prototype builds the geometry itself and
 * draws it with a PathLayer.
 */
export function arcPath(
  source: [number, number],
  target: [number, number],
  segments = ARC_SEGMENTS,
): [number, number, number][] {
  const peak = greatCircleMeters(source, target) * ARC_PEAK_RATIO;
  const path: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const [lng, lat] = getGreatCircleInterpolation(source, target, f);
    path.push([lng, lat, Math.sin(Math.PI * f) * peak]);
  }
  return path;
}

/** Relative luminance (sRGB, 0–1). */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Below this, a colour disappears into the night-side globe. */
export const MIN_ARC_LUMINANCE = 0.18;

/**
 * Liveries can be any colour, often a deep navy that vanishes on the dark
 * globe: mix toward white just enough to stay readable, keeping the hue.
 */
export function readableOnDark(rgb: [number, number, number]): [number, number, number] {
  if (luminance(rgb) >= MIN_ARC_LUMINANCE) return rgb;
  for (let t = 0.05; t < 1; t += 0.05) {
    const mixed = rgb.map((c) => Math.round(c + (255 - c) * t)) as [number, number, number];
    if (luminance(mixed) >= MIN_ARC_LUMINANCE) return mixed;
  }
  return [255, 255, 255];
}

/** Width grows with weekly frequency (daily = 7/wk), capped so trunk routes stay readable. */
export function arcWidth(frequencyPerWeek: number | undefined, isPlayer: boolean): number {
  const base = isPlayer ? 3 : 1;
  const perDay = Math.max(1, (frequencyPerWeek ?? 7) / 7);
  return Math.min(base + Math.log2(perDay) * 1.5, isPlayer ? 8 : 4);
}

export interface ArcOwner {
  routes: readonly Route[];
  colorHex: string | undefined;
  isPlayer: boolean;
}

/**
 * Active routes of every airline as great-circle arcs, player last so it
 * draws on top. Routes whose airports aren't in the catalog are skipped.
 * O(routes).
 */
export function buildRouteArcs(
  owners: readonly ArcOwner[],
  lookupAirport: (iata: string) => Pick<Airport, "latitude" | "longitude"> | undefined,
): RouteArc[] {
  const arcs: RouteArc[] = [];
  const ordered = [...owners.filter((o) => !o.isPlayer), ...owners.filter((o) => o.isPlayer)];
  for (const owner of ordered) {
    const [r, g, b] = readableOnDark(hexToRgb(owner.colorHex));
    const alpha = owner.isPlayer ? PLAYER_ALPHA : RIVAL_ALPHA;
    for (const route of owner.routes) {
      if (route.status !== "active") continue;
      const origin = lookupAirport(route.originIata);
      const destination = lookupAirport(route.destinationIata);
      if (!origin || !destination) continue;
      const source: [number, number] = [origin.longitude, origin.latitude];
      const target: [number, number] = [destination.longitude, destination.latitude];
      arcs.push({
        id: route.id,
        originIata: route.originIata,
        destinationIata: route.destinationIata,
        ownerPubkey: route.airlinePubkey,
        frequencyPerWeek: route.frequencyPerWeek,
        distanceKm: route.distanceKm,
        source,
        target,
        path: arcPath(source, target),
        color: [r, g, b, alpha],
        width: arcWidth(route.frequencyPerWeek, owner.isPlayer),
        isPlayer: owner.isPlayer,
      });
    }
  }
  return arcs;
}

/**
 * Where to point the camera first: the middle of the player's network (by
 * the mean of its endpoints) and a zoom that fits its widest span. Null when
 * the player flies nothing yet.
 */
export function playerNetworkFocus(
  arcs: readonly RouteArc[],
): { center: [number, number]; zoom: number } | null {
  const points = arcs.filter((arc) => arc.isPlayer).flatMap((arc) => [arc.source, arc.target]);
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const center: [number, number] = [
    lngs.reduce((a, b) => a + b, 0) / lngs.length,
    lats.reduce((a, b) => a + b, 0) / lats.length,
  ];
  const span = Math.max(
    Math.max(...lngs) - Math.min(...lngs),
    Math.max(...lats) - Math.min(...lats),
    1,
  );
  // About 360° of span at zoom 0; halve the span per zoom level, with margin.
  const zoom = Math.min(5, Math.max(1.2, Math.log2(360 / span) - 1.5));
  return { center, zoom };
}

/** An airport on someone's network, for the clickable airport layer. */
export interface NetworkAirport {
  iata: string;
  position: [number, number];
  /** On the player's own network. */
  isPlayer: boolean;
}

/** Every airport at either end of an arc, once; the player's flag wins. O(arcs). */
export function networkAirports(arcs: readonly RouteArc[]): NetworkAirport[] {
  const byIata = new Map<string, NetworkAirport>();
  for (const arc of arcs) {
    for (const [iata, position] of [
      [arc.originIata, arc.source],
      [arc.destinationIata, arc.target],
    ] as const) {
      const known = byIata.get(iata);
      if (known) known.isPlayer ||= arc.isPlayer;
      else byIata.set(iata, { iata, position, isPlayer: arc.isPlayer });
    }
  }
  return [...byIata.values()];
}
