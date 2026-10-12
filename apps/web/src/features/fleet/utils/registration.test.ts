import { describe, expect, it } from "vitest";
import { registrationFor } from "./registration";

describe("registrationFor", () => {
  it("is short, stable and readable", () => {
    const mark = registrationFor("ac-47dd468e-a80et-2-0");
    expect(mark).toMatch(/^AC-[A-HJ-NP-Z0-9]{5}$/);
    expect(registrationFor("ac-47dd468e-a80et-2-0")).toBe(mark);
  });

  it("tells planes apart", () => {
    const marks = new Set(
      Array.from({ length: 500 }, (_, i) => registrationFor(`ac-47dd468e-${i}`)),
    );
    expect(marks.size).toBe(500);
  });
});
