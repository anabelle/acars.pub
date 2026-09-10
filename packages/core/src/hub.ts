import type { HubState, Route } from "./types.js";

export function buildHubState(hubIata: string, routes: Route[]): HubState {
  let weeklyFrequency = 0;
  let spokeCount = 0;

  for (const route of routes) {
    // A spoke connects to the hub whether the route departs from it or
    // lands at it — count both directions (and their frequencies).
    const departsFromHub = route.originIata === hubIata;
    const landsAtHub = route.destinationIata === hubIata;
    if (!departsFromHub && !landsAtHub) continue;
    spokeCount += 1;
    weeklyFrequency += route.frequencyPerWeek ?? 0;
  }

  return {
    hubIata,
    spokeCount,
    weeklyFrequency,
    avgFrequency: spokeCount > 0 ? weeklyFrequency / spokeCount : 0,
  };
}

export function getAirportTraffic(iata: string, routes: Route[]): number {
  let weeklyFlights = 0;

  for (const route of routes) {
    const weekly = route.frequencyPerWeek ?? 0;
    if (route.originIata === iata) weeklyFlights += weekly;
    if (route.destinationIata === iata) weeklyFlights += weekly;
  }

  return weeklyFlights / (7 * 24);
}
