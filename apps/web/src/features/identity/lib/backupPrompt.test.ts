import { describe, expect, it } from "vitest";
import { type BackupPromptStorage, dueBackupPrompt, markBackupPromptShown } from "./backupPrompt";

const memory = () => {
  const state = new Map<string, string>();
  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => void state.set(key, value),
  };
};
const browser = (): BackupPromptStorage => ({ local: memory(), session: memory() });
/** A later visit: same device storage, a fresh session. */
const nextVisit = (storage: BackupPromptStorage): BackupPromptStorage => ({
  local: storage.local,
  session: memory(),
});
const flown = { hasLanded: true, secured: false };

describe("dueBackupPrompt()", () => {
  it("waits for the first landing", () => {
    expect(dueBackupPrompt("pk", { hasLanded: false, secured: false }, browser())).toBeNull();
  });

  it("asks after the first landing, then once on the next visit, then never", () => {
    const visit1 = browser();
    expect(dueBackupPrompt("pk", flown, visit1)).toBe("landing");
    markBackupPromptShown("pk", "landing", visit1);
    // Not again in the same visit.
    expect(dueBackupPrompt("pk", flown, visit1)).toBeNull();

    const visit2 = nextVisit(visit1);
    expect(dueBackupPrompt("pk", flown, visit2)).toBe("return");
    markBackupPromptShown("pk", "return", visit2);
    expect(dueBackupPrompt("pk", flown, visit2)).toBeNull();

    expect(dueBackupPrompt("pk", flown, nextVisit(visit2))).toBeNull();
  });

  it("asks nothing once the key is backed up", () => {
    expect(dueBackupPrompt("pk", { hasLanded: true, secured: true }, browser())).toBeNull();
  });

  it("keeps accounts apart", () => {
    const storage = browser();
    markBackupPromptShown("pk", "landing", storage);
    expect(dueBackupPrompt("other", flown, storage)).toBe("landing");
  });

  it("survives blocked storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const storage = { local: blocked, session: blocked };
    expect(dueBackupPrompt("pk", flown, storage)).toBe("landing");
    expect(() => markBackupPromptShown("pk", "landing", storage)).not.toThrow();
  });
});
