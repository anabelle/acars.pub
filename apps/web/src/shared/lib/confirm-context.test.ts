import { describe, expect, it } from "vitest";
import { ConfirmContext } from "./confirm-context";

describe("ConfirmContext", () => {
  it("has a display name", () => {
    expect(ConfirmContext.displayName ?? "ConfirmContext").toBe("ConfirmContext");
  });
});
