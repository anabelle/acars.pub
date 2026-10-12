import { describe, expect, it } from "vitest";
import { findDeliveries } from "./deliveries";

const ac = (id: string, status: string, modelId = "atr72-600") =>
  ({ id, status, modelId }) as never;

describe("findDeliveries (S61)", () => {
  it("finds planes that just left delivery", () => {
    expect(
      findDeliveries([ac("a", "delivery"), ac("b", "idle")], [ac("a", "idle"), ac("b", "enroute")]),
    ).toEqual([{ aircraftId: "a", firstOfType: false }]);
    expect(findDeliveries([ac("a", "delivery")], [ac("a", "idle")])).toEqual([
      { aircraftId: "a", firstOfType: true },
    ]);
  });

  it("is quiet when nothing was delivered", () => {
    expect(findDeliveries([ac("a", "delivery")], [ac("a", "delivery")])).toEqual([]);
    expect(findDeliveries([], [ac("a", "idle")])).toEqual([]);
  });

  it("marks only the first plane of a model as first of its type", () => {
    expect(
      findDeliveries(
        [
          ac("old", "idle"),
          ac("x", "delivery"),
          ac("y", "delivery", "dash8-q400"),
          ac("z", "delivery", "dash8-q400"),
        ],
        [
          ac("old", "idle"),
          ac("x", "idle"),
          ac("y", "idle", "dash8-q400"),
          ac("z", "idle", "dash8-q400"),
        ],
      ),
    ).toEqual([
      { aircraftId: "x", firstOfType: false },
      { aircraftId: "y", firstOfType: true },
      { aircraftId: "z", firstOfType: false },
    ]);
  });
});
