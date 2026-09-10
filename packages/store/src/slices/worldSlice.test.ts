import type { AircraftInstance, AirlineEntity } from "@acars/core";
import { computeCheckpointStateHash, fp } from "@acars/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import type { AirlineState } from "../types";
import { _resetWorldFlags, createWorldSlice } from "./worldSlice";

vi.mock("@acars/core", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@acars/core")>();
  return {
    ...mod,
    decompressSnapshotString: vi.fn((data: string) => Promise.resolve(data)),
  };
});

vi.mock("@acars/nostr", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@acars/nostr")>();
  return {
    ...mod,
    loadAllSnapshots: vi.fn(() => Promise.resolve(new Map())),
    getNDK: vi.fn(() => ({})),
    NDKEvent: vi.fn(),
    MARKETPLACE_KIND: 30079,
    deleteMarketplaceListing: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../engine", () => ({
  useEngineStore: {
    setState: vi.fn(),
    getState: () => ({
      tick: 100,
    }),
  },
}));

vi.mock("../FlightEngine", () => ({
  reconcileFleetToTick: vi.fn((fleet) => ({
    fleet,
    balanceDelta: 0,
    events: [],
  })),
}));

const createSliceState = (overrides: Partial<AirlineState> = {}) => {
  const state = {
    airline: null,
    fleet: [],
    routes: [],
    timeline: [],
    actionChainHash: "",
    actionSeq: 0,
    latestCheckpoint: null,
    pubkey: "player-pubkey",
    identityStatus: "ready",
    isLoading: false,
    error: null,
    initializeIdentity: vi.fn(),
    createAirline: vi.fn(),
    modifyHubs: vi.fn(),
    purchaseAircraft: vi.fn(),
    sellAircraft: vi.fn(),
    buyoutAircraft: vi.fn(),
    purchaseUsedAircraft: vi.fn(),
    listAircraft: vi.fn(),
    cancelListing: vi.fn(),
    performMaintenance: vi.fn(),
    ferryAircraft: vi.fn(),
    openRoute: vi.fn(),
    rebaseRoute: vi.fn(),
    closeRoute: vi.fn(),
    assignAircraftToRoute: vi.fn(),
    updateRouteFares: vi.fn(),
    updateHub: vi.fn(),
    processTick: vi.fn(),
    competitors: new Map(),
    globalRouteRegistry: new Map(),
    fleetByOwner: new Map(),
    routesByOwner: new Map(),
    syncWorld: vi.fn(),
    syncCompetitor: vi.fn(),
    projectCompetitorFleet: vi.fn(),
  } as unknown as AirlineState;

  const set = vi.fn((partial: AirlineState | ((prev: AirlineState) => Partial<AirlineState>)) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    Object.assign(state, next);
  });
  const get = () => state;

  const slice = (createWorldSlice as StateCreator<AirlineState>)(set, get, {} as never);
  Object.assign(state, slice);
  Object.assign(state, overrides);
  return { state, set };
};

const buildFleetIndex = (fleet: AircraftInstance[]) => {
  const byOwner = new Map<string, AircraftInstance[]>();
  for (const aircraft of fleet) {
    const bucket = byOwner.get(aircraft.ownerPubkey);
    if (bucket) {
      bucket.push(aircraft);
    } else {
      byOwner.set(aircraft.ownerPubkey, [aircraft]);
    }
  }
  return byOwner;
};

const makeAirline = (pubkey: string, lastTick: number): AirlineEntity => ({
  id: `airline-${pubkey}`,
  foundedBy: pubkey,
  status: "private",
  ceoPubkey: pubkey,
  sharesOutstanding: 10000000,
  shareholders: { [pubkey]: 10000000 },
  name: `Airline ${pubkey}`,
  icaoCode: "TST",
  callsign: "TEST",
  hubs: ["JFK"],
  livery: { primary: "#000000", secondary: "#ffffff", accent: "#ffffff" },
  brandScore: 0.5,
  tier: 1,
  cumulativeRevenue: fp(0),
  corporateBalance: fp(1000000000),
  stockPrice: fp(0),
  fleetIds: [],
  routeIds: [],
  lastTick,
  timeline: [],
});

const makeAircraft = (id: string, ownerPubkey: string): AircraftInstance => ({
  id,
  ownerPubkey,
  modelId: "atr72-600",
  name: "Plane",
  status: "idle",
  assignedRouteId: null,
  baseAirportIata: "JFK",
  purchasedAtTick: 0,
  purchasePrice: fp(1000000),
  birthTick: 0,
  flight: null,
  purchaseType: "buy",
  configuration: { economy: 70, business: 0, first: 0, cargoKg: 0 },
  flightHoursTotal: 0,
  flightHoursSinceCheck: 0,
  condition: 1,
});

/**
 * Builds a relay SnapshotPayload carrying a checkpoint whose stateHash is
 * genuinely computed over its contents (mirrors publishCurrentStateSnapshot).
 */
async function makeSnapshotPayload(checkpoint: {
  tick: number;
  airline: AirlineEntity;
  fleet: AircraftInstance[];
  routes: never[];
}): Promise<{ compressedData: string; stateHash: string; tick: number }> {
  const stateHash = await computeCheckpointStateHash({
    airline: checkpoint.airline,
    fleet: checkpoint.fleet,
    routes: checkpoint.routes,
    timeline: [],
  });
  const body = {
    schemaVersion: 1,
    tick: checkpoint.tick,
    createdAt: Date.now(),
    actionChainHash: "chain-test",
    stateHash,
    airline: checkpoint.airline,
    fleet: checkpoint.fleet,
    routes: checkpoint.routes,
    timeline: [],
  };
  return { compressedData: JSON.stringify(body), stateHash, tick: checkpoint.tick };
}

describe("projectCompetitorFleet", () => {
  beforeEach(async () => {
    _resetWorldFlags();
  });

  it("projects all competitor fleets to the target tick", () => {
    const tick = 200;
    const behindPubkey = "comp-behind";
    const currentPubkey = "comp-current";

    const competitors = new Map<string, AirlineEntity>([
      [behindPubkey, makeAirline(behindPubkey, tick - 2)],
      [currentPubkey, makeAirline(currentPubkey, tick)],
    ]);

    const allFleet = [
      makeAircraft("ac-behind", behindPubkey),
      makeAircraft("ac-current", currentPubkey),
    ];

    const { state } = createSliceState({
      competitors,
      fleetByOwner: buildFleetIndex(allFleet),
      routesByOwner: new Map(),
    });

    state.projectCompetitorFleet(tick);

    const ids = [...state.fleetByOwner.values()].flat().map((ac) => ac.id);
    expect(ids).toContain("ac-behind");
    expect(ids).toContain("ac-current");

    const updatedBehind = state.competitors.get(behindPubkey);
    expect(updatedBehind?.lastTick).toBe(tick - 2);
  });

  it("does not project bankrupt competitors", () => {
    const tick = 200;
    const pubkey = "comp-bankrupt";
    const airline = {
      ...makeAirline(pubkey, tick - 50),
      status: "chapter11" as const,
    };
    const aircraft: AircraftInstance = {
      ...makeAircraft("ac-bankrupt", pubkey),
      status: "enroute",
      assignedRouteId: "rt-1",
      flight: {
        originIata: "JFK",
        destinationIata: "LAX",
        departureTick: 100,
        arrivalTick: 150,
        distanceKm: 2000,
        direction: "outbound" as const,
        purpose: "route" as const,
      },
    };

    const { state, set } = createSliceState({
      competitors: new Map([[pubkey, airline]]),
      fleetByOwner: buildFleetIndex([aircraft]),
      routesByOwner: new Map(),
    });

    state.projectCompetitorFleet(tick);

    expect(set).not.toHaveBeenCalled();
    expect(state.fleetByOwner.get(pubkey)?.[0].id).toBe("ac-bankrupt");
  });
});

describe("syncWorld", () => {
  beforeEach(async () => {
    _resetWorldFlags();
    const nostr = await import("@acars/nostr");
    vi.mocked(nostr.loadAllSnapshots).mockClear();
    vi.mocked(nostr.loadAllSnapshots).mockResolvedValue(new Map());
  });

  it("loads and installs snapshots for competitors", async () => {
    const pubkey = "comp-new";
    const newAirline = makeAirline(pubkey, 120);
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: newAirline,
      fleet: [makeAircraft("ac-new", pubkey)],
      routes: [],
    });

    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, payload]]));

    const { state } = createSliceState();

    await state.syncWorld();

    expect(state.competitors.has("comp-new")).toBe(true);
    expect([...state.fleetByOwner.values()].flat().map((a) => a.id)).toContain("ac-new");
  });

  it("ignores bankrupt states", async () => {
    const pubkey = "comp-bankrupt";
    const bankruptAirline = {
      ...makeAirline(pubkey, 100),
      status: "chapter11",
    };
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: bankruptAirline,
      fleet: [makeAircraft("ac-new", pubkey)],
      routes: [],
    });

    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, payload]]));

    const { state } = createSliceState();

    await state.syncWorld();

    expect(state.competitors.has("comp-bankrupt")).toBe(true);
    expect(state.competitors.get("comp-bankrupt")?.status).toBe("chapter11");
  });

  it("rejects snapshots whose state hash does not verify", async () => {
    const pubkey = "comp-tampered";
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: makeAirline(pubkey, 120),
      fleet: [makeAircraft("ac-tampered", pubkey)],
      routes: [],
    });
    // Tamper: ship a different hash on the relay payload than the body declares.
    const tampered = { ...payload, stateHash: "deadbeef" };

    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, tampered]]));

    const { state } = createSliceState();

    await state.syncWorld();

    expect(state.competitors.has("comp-tampered")).toBe(false);
    expect(state.fleetByOwner.has(pubkey)).toBe(false);
  });

  it("rejects snapshots with a fleet larger than the defensive cap", async () => {
    const pubkey = "comp-huge";
    const hugeFleet = Array.from({ length: 5001 }, (_, i) => makeAircraft(`ac-huge-${i}`, pubkey));
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: makeAirline(pubkey, 120),
      fleet: hugeFleet,
      routes: [],
    });

    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, payload]]));

    const { state } = createSliceState();

    await state.syncWorld();

    expect(state.competitors.has("comp-huge")).toBe(false);
  });

  it("rejects snapshots with an out-of-range corporate balance", async () => {
    const pubkey = "comp-rich";
    const richAirline = {
      ...makeAirline(pubkey, 120),
      corporateBalance: fp(50_000_000_000), // $50B — outside the ±$10B clamp
    };
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: richAirline,
      fleet: [],
      routes: [],
    });

    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, payload]]));

    const { state } = createSliceState();

    await state.syncWorld();

    expect(state.competitors.has("comp-rich")).toBe(false);
  });
});

describe("syncCompetitor", () => {
  beforeEach(async () => {
    _resetWorldFlags();
    const nostr = await import("@acars/nostr");
    vi.mocked(nostr.loadAllSnapshots).mockClear();
    vi.mocked(nostr.loadAllSnapshots).mockResolvedValue(new Map());
  });

  it("applies live events incrementally over the cached competitor state", async () => {
    const pubkey = "comp-live";
    const competitor = makeAirline(pubkey, 120);

    // Prime the cache (and the full-sync watermark) via a full syncWorld.
    const payload = await makeSnapshotPayload({
      tick: 120,
      airline: competitor,
      fleet: [makeAircraft("ac-live", pubkey)],
      routes: [],
    });
    const { loadAllSnapshots } = await import("@acars/nostr");
    vi.mocked(loadAllSnapshots).mockResolvedValueOnce(new Map([[pubkey, payload]]));

    const { state } = createSliceState();
    await state.syncWorld();
    expect(state.competitors.has(pubkey)).toBe(true);

    // From here on, syncWorld must NOT be called again — live events are
    // replayed over the cache instead of triggering a full resync.
    const syncWorldSpy = vi.fn();
    state.syncWorld = syncWorldSpy;

    await state.syncCompetitor(pubkey, [
      {
        event: { id: "evt-live-1", created_at: 200, author: { pubkey } },
        action: {
          schemaVersion: 2,
          action: "HUB_ADD",
          payload: { iata: "LAX", fee: fp(0), tick: 125 },
        },
      } as never,
    ]);

    expect(syncWorldSpy).not.toHaveBeenCalled();
    const updated = state.competitors.get(pubkey);
    expect(updated?.hubs).toContain("LAX");
    expect(updated?.lastTick).toBe(125);
  });

  it("full-resyncs when no live events are provided", async () => {
    const { state } = createSliceState();
    const syncWorldSpy = vi.fn();
    state.syncWorld = syncWorldSpy;

    await state.syncCompetitor("comp-unknown");

    expect(syncWorldSpy).toHaveBeenCalledTimes(1);
  });

  it("full-resyncs when the competitor is not cached yet", async () => {
    const { state } = createSliceState();
    const syncWorldSpy = vi.fn();
    state.syncWorld = syncWorldSpy;

    await state.syncCompetitor("comp-uncached", [
      {
        event: { id: "evt-live-2", created_at: 200, author: { pubkey: "comp-uncached" } },
        action: {
          schemaVersion: 2,
          action: "HUB_ADD",
          payload: { iata: "LAX", fee: fp(0), tick: 125 },
        },
      } as never,
    ]);

    expect(syncWorldSpy).toHaveBeenCalledTimes(1);
  });
});
