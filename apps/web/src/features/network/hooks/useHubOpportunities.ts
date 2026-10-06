import { TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect, useRef, useState } from "react";
import type { HubOpportunity } from "@/features/network/utils/hubOpportunities";
import type {
  OpportunityRequest,
  OpportunityResponse,
} from "@/features/network/utils/opportunityRequests";

export type OpportunityWorkerFactory = () => Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage"
>;

const createWorker: OpportunityWorkerFactory = () =>
  new Worker(new URL("../../../workers/opportunities.ts", import.meta.url), { type: "module" });

export interface HubOpportunitiesState {
  hubIata: string | null;
  opportunities: HubOpportunity[] | null;
  pending: boolean;
}

/**
 * Projected profit per day for `hubIata`'s best unserved destinations,
 * computed in a worker (S43) and refreshed once per game hour or when the
 * network changes. Null hub (or no Worker support) means no computation.
 */
export function useHubOpportunities(
  hubIata: string | null,
  workerFactory: OpportunityWorkerFactory = createWorker,
): HubOpportunitiesState {
  const tier = useAirlineStore((s) => s.airline?.tier ?? 1);
  const brandScore = useAirlineStore((s) => s.airline?.brandScore ?? 0.5);
  const pubkey = useAirlineStore((s) => s.pubkey ?? "");
  const routes = useAirlineStore((s) => s.routes);
  const registry = useAirlineStore((s) => s.globalRouteRegistry);
  const hourTick = useEngineStore((s) => Math.floor(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);

  const workerRef = useRef<ReturnType<OpportunityWorkerFactory> | null>(null);
  // A ref, so a factory passed inline doesn't re-run the request effect.
  const factoryRef = useRef(workerFactory);
  const latestId = useRef(0);
  const [result, setResult] = useState<{
    hubIata: string;
    opportunities: HubOpportunity[];
  } | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // One worker per hook instance, created on first use.
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!hubIata) return;
    if (factoryRef.current === createWorker && typeof Worker === "undefined") return;
    if (!workerRef.current) {
      const worker = factoryRef.current();
      worker.onmessage = (event: MessageEvent<OpportunityResponse>) => {
        const response = event.data;
        if (response.id !== latestId.current) return; // a newer request superseded it
        setResult({ hubIata: response.hubIata, opportunities: response.opportunities });
        setPendingId(null);
      };
      workerRef.current = worker;
    }
    const id = ++latestId.current;
    const request: OpportunityRequest = {
      id,
      input: {
        hubIata,
        tier,
        tick: hourTick,
        brandScore,
        playerPubkey: pubkey,
        routes: routes.map((r) => ({
          originIata: r.originIata,
          destinationIata: r.destinationIata,
          frequencyPerWeek: r.frequencyPerWeek,
        })),
        registry: registry ?? new Map(),
      },
    };
    setPendingId(id);
    workerRef.current.postMessage(request);
  }, [hubIata, tier, brandScore, pubkey, routes, registry, hourTick]);

  const current = result && result.hubIata === hubIata ? result.opportunities : null;
  return {
    hubIata,
    opportunities: hubIata ? current : null,
    pending: hubIata !== null && pendingId !== null,
  };
}
