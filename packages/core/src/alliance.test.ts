import { describe, expect, it } from "vitest";
import {
  allianceStatus,
  CODESHARE_SHARE,
  MAX_ALLIANCE_PARTNERS,
  mutualPartners,
  parsePartners,
} from "./alliance.js";

const key = (c: string) => c.repeat(64);

describe("alliances (S73)", () => {
  it("parses up to three unique, valid partners, never oneself", () => {
    expect(MAX_ALLIANCE_PARTNERS).toBe(3);
    expect(CODESHARE_SHARE).toBe(0.7);
    expect(
      parsePartners(
        [key("a"), key("a"), "nope", 7, key("b"), key("c"), key("d"), key("e")],
        key("c"),
      ),
    ).toEqual([key("a"), key("b"), key("d")]);
    expect(parsePartners([])).toEqual([]);
    expect(parsePartners("x")).toBeNull();
  });

  it("tells proposed, invited and allied apart", () => {
    const me = key("a");
    const them = key("b");
    expect(allianceStatus([], [], me, them)).toBe("none");
    expect(allianceStatus(undefined, undefined, me, them)).toBe("none");
    expect(allianceStatus([them], [], me, them)).toBe("proposed");
    expect(allianceStatus([], [me], me, them)).toBe("invited");
    expect(allianceStatus([them], [me], me, them)).toBe("allied");
  });

  it("keeps only partners who name me back", () => {
    const me = key("a");
    const lists = new Map([
      [key("b"), [me]],
      [key("c"), [key("d")]],
    ]);
    expect(mutualPartners(me, [key("b"), key("c"), key("e")], (p) => lists.get(p))).toEqual([
      key("b"),
    ]);
    expect(mutualPartners(me, undefined, () => [me])).toEqual([]);
  });
});
