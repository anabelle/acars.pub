import { describe, expect, it } from "vitest";
import type { ConfirmOptions } from "./confirm";

describe("ConfirmOptions", () => {
  it("accepts required fields", () => {
    const options: ConfirmOptions = { title: "Delete route?" };
    expect(options.title).toBe("Delete route?");
  });

  it("supports optional fields", () => {
    const options: ConfirmOptions = {
      title: "Remove aircraft",
      description: "This action cannot be undone.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      tone: "destructive",
    };
    expect(options.tone).toBe("destructive");
  });
});
