import { describe, expect, it } from "vitest";
import { ROUTE_ALIASES, resolveRouteAlias } from "./routeAliases";

describe("route aliases", () => {
  it("maps every navigation name to its canonical path", () => {
    expect(ROUTE_ALIASES).toEqual({
      "/routes": "/network",
      "/rivals": "/leaderboard",
      "/finance": "/corporate",
      "/info": "/about",
    });
  });

  it("keeps search params and replaces history", () => {
    expect(resolveRouteAlias("/routes", { tab: "opportunities" })).toEqual({
      to: "/network",
      search: { tab: "opportunities" },
      replace: true,
    });
    expect(resolveRouteAlias("/finance", { section: "hubs" })).toEqual({
      to: "/corporate",
      search: { section: "hubs" },
      replace: true,
    });
  });

  it("does not share the caller's search object", () => {
    const search = { tab: "active" };
    expect(resolveRouteAlias("/routes", search).search).not.toBe(search);
  });
});
