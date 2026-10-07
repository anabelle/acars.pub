import { type Airport, fp, fpAdd, fpSub, objectiveDayWindow } from "@acars/core";
import { setAirportsCatalog } from "@acars/data";
import { beforeAll, describe, expect, it } from "vitest";
import { type ActionRecord, replayActionLog } from "./actionReducer";

/**
 * S32.3: CLAIM_OBJECTIVE is verified during replay (D6). 2026-10-07's
 * objectives: open a route ≥1,000 km ($150k), open a route to a business
 * airport ($150k), adjust a schedule ($25k).
 */

const PUBKEY = "claim-player";
const DATE = "2026-10-07";
const DAY = objectiveDayWindow(DATE);
const START_BALANCE = fp(100_000_000);
const SLOT_FEE = fp(100_000);

const airport = (iata: string, latitude: number, longitude: number, tags: string[]) =>
  ({ iata, latitude, longitude, tags }) as unknown as Airport;

beforeAll(() => {
  setAirportsCatalog([
    airport("MAD", 40.47, -3.56, ["business"]),
    airport("BCN", 41.3, 2.08, ["beach"]),
    airport("JFK", 40.64, -73.78, ["business"]),
  ]);
});

let seq = 0;
const record = (
  action: string,
  tick: number,
  payload: Record<string, unknown> = {},
  author = PUBKEY,
): ActionRecord => {
  seq += 1;
  return {
    eventId: `claim-evt-${seq}`,
    authorPubkey: author,
    createdAt: null,
    action: { schemaVersion: 2, action: action as never, payload: { ...payload, tick } },
  };
};
const create = (tick: number) =>
  record("AIRLINE_CREATE", tick, {
    name: "Claim Air",
    hubs: ["MAD"],
    corporateBalance: START_BALANCE,
  });
const openRoute = (tick: number, routeId: string, destinationIata: string, distanceKm = 500) =>
  record("ROUTE_OPEN", tick, { routeId, originIata: "MAD", destinationIata, distanceKm });
const claim = (tick: number, kind: string, date = DATE) =>
  record("CLAIM_OBJECTIVE", tick, { objectiveId: `${date}:${kind}` });

const t = DAY.startTick + 100;

describe("CLAIM_OBJECTIVE replay", () => {
  it("credits a completed objective once, with a timeline entry", async () => {
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "JFK"),
        claim(t + 2, "openRoute"),
        claim(t + 3, "openRoute"),
      ],
    });
    // Slot fee paid, one $150k reward; the duplicate claim pays nothing.
    expect(result.airline?.corporateBalance).toBe(
      fpAdd(fpSub(START_BALANCE, SLOT_FEE), fp(150_000)),
    );
    expect(result.objectives.claimed).toEqual([`${DATE}:openRoute`]);
    const rewards = result.timeline.filter((event) => event.type === "objective_reward");
    expect(rewards).toHaveLength(1);
    expect(rewards[0].revenue).toBe(fp(150_000));
  });

  it("rejects incomplete, early, foreign and unknown claims", async () => {
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        // A short route: doesn't meet the 1,000 km objective even though
        // the payload claims a long distance.
        openRoute(t + 1, "r1", "BCN", 9_000),
        claim(t + 2, "openRoute"),
        // Claimed before the work was done: the later route doesn't rescue it.
        claim(t + 3, "openRouteToTag"),
        openRoute(t + 4, "r2", "JFK"),
        // Not one of today's objectives; not a valid date; tomorrow's objective today.
        claim(t + 5, "tuneFares"),
        claim(t + 6, "openRoute", "2026-13-01"),
        claim(t + 7, "adjustSchedule", "2026-10-08"),
      ],
    });
    expect(result.objectives.claimed).toEqual([]);
    expect(result.airline?.corporateBalance).toBe(fpSub(START_BALANCE, fp(200_000)));
    expect(result.timeline.some((event) => event.type === "objective_reward")).toBe(false);
  });

  it("allows a claim the next day but not after", async () => {
    const lateButFine = await replayActionLog({
      pubkey: PUBKEY,
      actions: [create(t), openRoute(t + 1, "r1", "JFK"), claim(DAY.endTick + 5, "openRoute")],
    });
    expect(lateButFine.objectives.claimed).toEqual([`${DATE}:openRoute`]);

    const tooLate = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "JFK"),
        claim(DAY.endTick + (DAY.endTick - DAY.startTick), "openRoute"),
      ],
    });
    expect(tooLate.objectives.claimed).toEqual([]);
  });

  it("two independent replays agree on balances after claims", async () => {
    const log = [
      create(t),
      openRoute(t + 1, "r1", "JFK"),
      claim(t + 2, "openRoute"),
      claim(t + 3, "openRouteToTag"),
      record("ROUTE_UPDATE_FREQUENCY", t + 4, { routeId: "r1", frequencyPerWeek: 10 }),
      claim(t + 5, "adjustSchedule"),
      // A duplicate after a checkpoint boundary must still be rejected.
      claim(DAY.endTick + 10, "openRoute"),
    ];

    // Client A replays the whole log; client B resumes from a checkpoint
    // taken mid-way, the way a snapshot or the live store does.
    const full = await replayActionLog({ pubkey: PUBKEY, actions: log });
    const head = await replayActionLog({ pubkey: PUBKEY, actions: log.slice(0, 3) });
    const resumed = await replayActionLog({
      pubkey: PUBKEY,
      actions: log.slice(3),
      checkpoint: {
        schemaVersion: 1,
        tick: t + 2,
        createdAt: 0,
        actionChainHash: head.actionChainHash,
        stateHash: "",
        airline: head.airline!,
        fleet: head.fleet,
        routes: head.routes,
        timeline: head.timeline,
      },
    });

    const expected = fpAdd(fpSub(START_BALANCE, SLOT_FEE), fp(150_000 + 150_000 + 25_000));
    expect(full.airline?.corporateBalance).toBe(expected);
    expect(resumed.airline?.corporateBalance).toBe(expected);
    expect(resumed.objectives).toEqual(full.objectives);
    expect(full.objectives.claimed).toHaveLength(3);
  });

  it("ignores claims by another author", async () => {
    const result = await replayActionLog({
      pubkey: PUBKEY,
      actions: [
        create(t),
        openRoute(t + 1, "r1", "JFK"),
        record("CLAIM_OBJECTIVE", t + 2, { objectiveId: `${DATE}:openRoute` }, "someone-else"),
      ],
    });
    expect(result.objectives.claimed).toEqual([]);
  });
});
