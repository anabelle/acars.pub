import { TICKS_PER_HOUR } from "@acars/core";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OpportunityRequest,
  OpportunityResponse,
} from "@/features/network/utils/opportunityRequests";
import { useHubOpportunities } from "./useHubOpportunities";

const initialAirline = useAirlineStore.getState();
const initialEngine = useEngineStore.getState();

/** A worker stand-in that records requests and replies on demand. */
function fakeWorker() {
  const worker = {
    requests: [] as OpportunityRequest[],
    onmessage: null as ((event: MessageEvent<OpportunityResponse>) => void) | null,
    postMessage: vi.fn((request: OpportunityRequest) => worker.requests.push(request)),
    terminate: vi.fn(),
    reply(request: OpportunityRequest, profit = 100) {
      act(() =>
        worker.onmessage?.({
          data: {
            id: request.id,
            hubIata: request.input.hubIata,
            opportunities: [
              { iata: "BCN", latitude: 0, longitude: 0, profitPerDay: profit, modelName: "x" },
            ],
            ms: 1,
            cached: false,
          },
        } as MessageEvent<OpportunityResponse>),
      );
    },
  };
  return worker;
}

beforeEach(() => {
  useAirlineStore.setState({
    airline: { tier: 2, brandScore: 0.6 },
    pubkey: "me",
    routes: [{ originIata: "MAD", destinationIata: "LIS", frequencyPerWeek: 7, id: "r1" }],
    globalRouteRegistry: new Map(),
  } as never);
  useEngineStore.setState({ tick: 3 * TICKS_PER_HOUR + 5 } as never);
});

afterEach(() => {
  useAirlineStore.setState(initialAirline, true);
  useEngineStore.setState(initialEngine, true);
});

describe("useHubOpportunities()", () => {
  it("asks the worker for the hub with the airline's state and returns its answer", () => {
    const worker = fakeWorker();
    const factory = vi.fn(() => worker as never);
    const { result } = renderHook(() => useHubOpportunities("MAD", factory));
    expect(result.current.pending).toBe(true);
    expect(worker.requests).toHaveLength(1);
    const { input } = worker.requests[0];
    expect(input).toMatchObject({
      hubIata: "MAD",
      tier: 2,
      brandScore: 0.6,
      playerPubkey: "me",
      tick: 3 * TICKS_PER_HOUR,
      routes: [{ originIata: "MAD", destinationIata: "LIS", frequencyPerWeek: 7 }],
    });
    worker.reply(worker.requests[0]);
    expect(result.current.pending).toBe(false);
    expect(result.current.opportunities?.[0].iata).toBe("BCN");
  });

  it("ignores superseded answers and re-asks only per game hour", () => {
    const worker = fakeWorker();
    const { result, rerender } = renderHook(
      ({ hub }) => useHubOpportunities(hub, () => worker as never),
      {
        initialProps: { hub: "MAD" as string | null },
      },
    );
    act(() => useEngineStore.setState({ tick: 3 * TICKS_PER_HOUR + 50 } as never));
    expect(worker.requests).toHaveLength(1); // same hour
    rerender({ hub: "BCN" });
    expect(worker.requests).toHaveLength(2);
    worker.reply(worker.requests[0], 1); // stale MAD answer
    expect(result.current.opportunities).toBeNull();
    worker.reply(worker.requests[1], 2);
    expect(result.current.opportunities?.[0].profitPerDay).toBe(2);
    act(() => useEngineStore.setState({ tick: 4 * TICKS_PER_HOUR } as never));
    expect(worker.requests).toHaveLength(3);
  });

  it("does nothing without a hub and terminates its worker on unmount", () => {
    const worker = fakeWorker();
    const factory = vi.fn(() => worker as never);
    const { result, rerender, unmount } = renderHook(
      ({ hub }) => useHubOpportunities(hub, factory),
      {
        initialProps: { hub: null as string | null },
      },
    );
    expect(factory).not.toHaveBeenCalled();
    expect(result.current).toEqual({ hubIata: null, opportunities: null, pending: false });
    rerender({ hub: "MAD" });
    unmount();
    expect(worker.terminate).toHaveBeenCalled();
  });
});
