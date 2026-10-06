import type { Airport } from "@acars/core";
import {
  computeHubOpportunities,
  type HubOpportunity,
  type HubOpportunityInput,
  OpportunityCache,
  opportunityCacheKey,
} from "@/features/network/utils/hubOpportunities";

/** Main thread → opportunities worker. */
export interface OpportunityRequest {
  id: number;
  input: HubOpportunityInput;
}

/** Opportunities worker → main thread. */
export interface OpportunityResponse {
  id: number;
  hubIata: string;
  opportunities: HubOpportunity[];
  /** Time spent computing (0 when served from the cache), for diagnostics. */
  ms: number;
  cached: boolean;
}

/**
 * Answers one request: from the cache when the hub, game hour and network
 * match an earlier one, else computed once the airports catalog is loaded.
 */
export function createOpportunityHandler(
  loadAirports: () => Promise<readonly Airport[]>,
  now: () => number = () => performance.now(),
  cache = new OpportunityCache(),
) {
  return async ({ id, input }: OpportunityRequest): Promise<OpportunityResponse> => {
    const key = opportunityCacheKey(input);
    const hit = cache.get(key);
    if (hit) return { id, hubIata: input.hubIata, opportunities: hit, ms: 0, cached: true };
    const airports = await loadAirports();
    const started = now();
    const opportunities = computeHubOpportunities(input, airports);
    cache.set(key, opportunities);
    return {
      id,
      hubIata: input.hubIata,
      opportunities,
      ms: Math.round(now() - started),
      cached: false,
    };
  };
}
