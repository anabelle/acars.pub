import type { TimelineEvent } from "@acars/core";
import { describe, expect, it } from "vitest";
import { newTimelineEvents } from "./timelineEvents";

const events = (...ids: string[]) =>
  ids.map((id) => ({
    id,
    tick: 0,
    timestamp: 0,
    type: "landing",
    description: "",
  })) as TimelineEvent[];

describe("newTimelineEvents()", () => {
  it("returns events newer than the last seen one, newest first", () => {
    expect(newTimelineEvents(events("c", "b", "a"), "a", 5).map((e) => e.id)).toEqual(["c", "b"]);
  });

  it("caps the count", () => {
    expect(newTimelineEvents(events("d", "c", "b", "a"), "a", 2).map((e) => e.id)).toEqual([
      "d",
      "c",
    ]);
  });

  it("returns nothing when nothing changed or the timeline is empty", () => {
    expect(newTimelineEvents(events("a"), "a", 5)).toEqual([]);
    expect(newTimelineEvents([], "a", 5)).toEqual([]);
  });

  it("treats only the newest as new when nothing was seen yet", () => {
    expect(newTimelineEvents(events("b", "a"), null, 5).map((e) => e.id)).toEqual(["b"]);
  });

  it("takes the newest `max` when the last seen event fell off", () => {
    expect(newTimelineEvents(events("c", "b", "a"), "zz", 2).map((e) => e.id)).toEqual(["c", "b"]);
  });
});
