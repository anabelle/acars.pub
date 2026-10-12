import type { AircraftInstance, Airport, Route, WeeklyPax } from "@acars/core";
import {
  bankQuality,
  CODESHARE_SHARE,
  calculateDemand,
  connectingDemand,
  detourFactor,
  GENESIS_TIME,
  getProsperityIndex,
  getSeason,
  haversineDistance,
  scaleToAddressableMarket,
  TICK_DURATION,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from "@acars/core";

export interface HubConnections {
  hubIata: string;
  /** 0.5–1, from how the airline's timed arrivals and departures line up. */
  quality: number;
  /** Connecting passengers a week through this hub. */
  weekly: number;
  /** The biggest flows, A→B, weekly passengers (at most 5). */
  pairs: { originIata: string; destinationIata: string; weekly: number }[];
  /** Passengers a week connecting here to or from allies' flights (S73), on our legs. */
  codeshareWeekly: number;
}

export interface ConnectionService {
  /** Per directed leg "MAD>BCN": weekly connecting passengers it carries. */
  byLeg: Map<string, WeeklyPax>;
  hubs: Map<string, HubConnections>;
}

export const legKey = (originIata: string, destinationIata: string) =>
  `${originIata}>${destinationIata}`;

const EMPTY: ConnectionService = { byLeg: new Map(), hubs: new Map() };
/** Hubs consider at most this many partner airports (largest markets first). */
const MAX_SPOKES = 30;

function add(map: Map<string, WeeklyPax>, key: string, pax: WeeklyPax) {
  const entry = map.get(key) ?? { economy: 0, business: 0, first: 0 };
  entry.economy += pax.economy;
  entry.business += pax.business;
  entry.first += pax.first;
  map.set(key, entry);
}

/**
 * Connecting passengers on an airline's network (S67): for every airport
 * where two of its routes meet and every pair it does not fly direct, the
 * share of that market that connects (detour, bank quality), added to both
 * legs. Aggregate, never per passenger.
 */
function networkOf(routes: readonly Route[]) {
  const spokes = new Map<string, Set<string>>();
  const direct = new Set<string>();
  for (const route of routes) {
    if (route.status !== "active") continue;
    direct.add(legKey(route.originIata, route.destinationIata));
    direct.add(legKey(route.destinationIata, route.originIata));
    for (const [a, b] of [
      [route.originIata, route.destinationIata],
      [route.destinationIata, route.originIata],
    ]) {
      const set = spokes.get(a) ?? new Set<string>();
      set.add(b);
      spokes.set(a, set);
    }
  }
  return { spokes, direct };
}

const scalePax = (pax: WeeklyPax, share: number): WeeklyPax => ({
  economy: Math.round(pax.economy * share),
  business: Math.round(pax.business * share),
  first: Math.round(pax.first * share),
});

export function computeConnectionService(
  routes: readonly Route[],
  fleet: readonly Pick<AircraftInstance, "line">[],
  tick: number,
  airport: (iata: string) => Airport | undefined,
  allyRoutes: readonly Route[] = [],
): ConnectionService {
  const { spokes, direct } = networkOf(routes);
  const ally = networkOf(allyRoutes);
  const ownLegs = [...spokes.values()].reduce((n, set) => n + set.size, 0) / 2;
  if (ownLegs < 2 && ally.spokes.size === 0) return EMPTY;
  if (ownLegs < 1) return EMPTY;

  // Timed arrivals and departures per airport, from lines of flying.
  const arrivals = new Map<string, number[]>();
  const departures = new Map<string, number[]>();
  for (const plane of fleet) {
    for (const leg of plane.line?.legs ?? []) {
      const list = departures.get(leg.originIata) ?? [];
      list.push(leg.departOffsetTicks);
      departures.set(leg.originIata, list);
      const arrivalList = arrivals.get(leg.destinationIata) ?? [];
      arrivalList.push((leg.departOffsetTicks + leg.durationTicks) % TICKS_PER_DAY);
      arrivals.set(leg.destinationIata, arrivalList);
    }
  }

  const date = new Date(GENESIS_TIME + tick * TICK_DURATION);
  const prosperity = getProsperityIndex(tick);
  const byLeg = new Map<string, WeeklyPax>();
  const hubs = new Map<string, HubConnections>();
  const km = (a: Airport, b: Airport) =>
    haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);

  for (const [hubIata, partners] of spokes) {
    if (partners.size < 2) continue;
    const hub = airport(hubIata);
    if (!hub) continue;
    const ends = [...partners]
      .map((iata) => airport(iata))
      .filter((a): a is Airport => Boolean(a))
      .sort((a, b) => b.population - a.population || a.iata.localeCompare(b.iata))
      .slice(0, MAX_SPOKES);
    const quality = bankQuality(arrivals.get(hubIata) ?? [], departures.get(hubIata) ?? []);
    const pairs: HubConnections["pairs"] = [];
    let weekly = 0;
    for (const from of ends) {
      for (const to of ends) {
        if (from.iata === to.iata || direct.has(legKey(from.iata, to.iata))) continue;
        const detour = detourFactor(km(from, to), km(from, hub), km(hub, to));
        if (detour <= 0) continue;
        const market = scaleToAddressableMarket(
          calculateDemand(from, to, getSeason(to.latitude, date), prosperity),
        );
        const pax = connectingDemand(market, detour, quality);
        const total = pax.economy + pax.business + pax.first;
        if (total <= 0) continue;
        add(byLeg, legKey(from.iata, hubIata), pax);
        add(byLeg, legKey(hubIata, to.iata), pax);
        weekly += total;
        pairs.push({ originIata: from.iata, destinationIata: to.iata, weekly: total });
      }
    }
    if (weekly > 0) {
      pairs.sort((a, b) => b.weekly - a.weekly || a.originIata.localeCompare(b.originIata));
      hubs.set(hubIata, { hubIata, quality, weekly, pairs: pairs.slice(0, 5), codeshareWeekly: 0 });
    }
  }

  // Codeshares (S73): where our route meets an ally's, passengers connect
  // across both; we carry our leg of each, at the codeshare share.
  const ends = (iatas: Iterable<string>) =>
    [...iatas]
      .map((iata) => airport(iata))
      .filter((a): a is Airport => Boolean(a))
      .sort((a, b) => b.population - a.population || a.iata.localeCompare(b.iata))
      .slice(0, MAX_SPOKES);
  for (const [hubIata, allyPartners] of ally.spokes) {
    const mine = spokes.get(hubIata);
    if (!mine) continue;
    const hub = airport(hubIata);
    if (!hub) continue;
    const ours = ends(mine);
    const theirs = ends([...allyPartners].filter((iata) => !mine.has(iata)));
    if (theirs.length === 0) continue;
    const quality = bankQuality(arrivals.get(hubIata) ?? [], departures.get(hubIata) ?? []);
    let codeshareWeekly = 0;
    const connect = (from: Airport, to: Airport, ourLeg: string) => {
      if (from.iata === to.iata) return;
      const pair = legKey(from.iata, to.iata);
      if (direct.has(pair) || ally.direct.has(pair)) return;
      const detour = detourFactor(km(from, to), km(from, hub), km(hub, to));
      if (detour <= 0) return;
      const market = scaleToAddressableMarket(
        calculateDemand(from, to, getSeason(to.latitude, date), prosperity),
      );
      const pax = scalePax(connectingDemand(market, detour, quality), CODESHARE_SHARE);
      const total = pax.economy + pax.business + pax.first;
      if (total <= 0) return;
      add(byLeg, ourLeg, pax);
      codeshareWeekly += total;
    };
    for (const from of ours) {
      for (const to of theirs) {
        connect(from, to, legKey(from.iata, hubIata));
        connect(to, from, legKey(hubIata, from.iata));
      }
    }
    if (codeshareWeekly > 0) {
      const existing = hubs.get(hubIata);
      hubs.set(
        hubIata,
        existing
          ? { ...existing, codeshareWeekly }
          : { hubIata, quality, weekly: 0, pairs: [], codeshareWeekly },
      );
    }
  }
  return { byLeg, hubs };
}

let cache: { key: string; service: ConnectionService } | null = null;

/**
 * `computeConnectionService`, re-run at most once per game hour and when the
 * network or a line changes (the engine asks every tick). Deterministic.
 */
export function buildConnectionService(
  routes: readonly Route[],
  fleet: readonly Pick<AircraftInstance, "line">[],
  tick: number,
  airport: (iata: string) => Airport | undefined,
  allyRoutes: readonly Route[] = [],
): ConnectionService {
  const hour = Math.floor(tick / TICKS_PER_HOUR);
  let signature = `${hour}|`;
  for (const route of routes) {
    signature += `${route.id}:${route.status}:${route.originIata}-${route.destinationIata};`;
  }
  signature += "|allies|";
  for (const route of allyRoutes) {
    signature += `${route.status}:${route.originIata}-${route.destinationIata};`;
  }
  for (const plane of fleet) {
    for (const leg of plane.line?.legs ?? [])
      signature += `${leg.routeId}@${leg.departOffsetTicks},`;
  }
  if (cache?.key === signature) return cache.service;
  const service = computeConnectionService(routes, fleet, tick, airport, allyRoutes);
  cache = { key: signature, service };
  return service;
}
