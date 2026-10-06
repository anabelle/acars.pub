import { describe, expect, it } from "vitest";
import { rivalRoutesNewOnYourPairs } from "./rivalRoutes.js";

const route = (o: string, d: string, status = "active") =>
  ({ originIata: o, destinationIata: d, status }) as never;

describe("rivalRoutesNewOnYourPairs()", () => {
  const mine = [route("MAD", "BCN"), route("MAD", "LIS"), route("MAD", "CDG", "suspended")];

  it("flags pairs the rival just started that you fly, in either direction", () => {
    const found = rivalRoutesNewOnYourPairs(
      mine,
      [route("BCN", "FCO")],
      [route("BCN", "FCO"), route("BCN", "MAD"), route("LIS", "OPO")],
    );
    expect(found).toEqual([{ key: expect.any(String), originIata: "MAD", destinationIata: "BCN" }]);
  });

  it("ignores pairs the rival already flew, your inactive routes and their inactive ones", () => {
    expect(
      rivalRoutesNewOnYourPairs(
        mine,
        [route("MAD", "BCN")],
        [route("MAD", "BCN"), route("MAD", "CDG")],
      ),
    ).toEqual([]);
    expect(rivalRoutesNewOnYourPairs(mine, [], [route("MAD", "LIS", "suspended")])).toEqual([]);
  });

  it("stays quiet on the first sync of a rival", () => {
    expect(rivalRoutesNewOnYourPairs(mine, undefined, [route("MAD", "BCN")])).toEqual([]);
  });
});
