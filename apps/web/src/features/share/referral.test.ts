import { describe, expect, it } from "vitest";
import { airlineNpub } from "@/features/airline/utils/airlineKey";
import { captureReferral, REFERRAL_STORAGE_KEY, readReferral, withReferral } from "./referral";

const A = "a".repeat(64);
const B = "b".repeat(64);

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe("referrals", () => {
  it("captures an npub or hex referrer, first touch wins", () => {
    const storage = memory();
    captureReferral(`?ref=${airlineNpub(A)}`, storage);
    expect(storage.getItem(REFERRAL_STORAGE_KEY)).toBe(A);
    captureReferral(`?ref=${B}`, storage);
    expect(storage.getItem(REFERRAL_STORAGE_KEY)).toBe(A);
  });

  it("ignores missing or malformed refs and blocked storage", () => {
    const storage = memory();
    captureReferral("", storage);
    captureReferral("?ref=nope", storage);
    expect(storage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
    expect(() =>
      captureReferral(`?ref=${A}`, {
        getItem: () => null,
        setItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
    captureReferral(`?ref=${A}`, null);
  });

  it("never credits the player themself", () => {
    const storage = memory();
    storage.setItem(REFERRAL_STORAGE_KEY, A);
    expect(readReferral(storage, B)).toBe(A);
    expect(readReferral(storage, A)).toBeNull();
    expect(readReferral(memory(), B)).toBeNull();
    expect(readReferral(null, B)).toBeNull();
  });

  it("adds the referrer to a link", () => {
    expect(withReferral("https://acars.pub/airline/x", A)).toBe(
      `https://acars.pub/airline/x?ref=${airlineNpub(A)}`,
    );
    expect(withReferral("https://acars.pub/join?lang=es", A)).toContain("&ref=npub1");
  });
});
