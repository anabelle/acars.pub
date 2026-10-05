import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every English string must exist in Spanish and vice versa, so a missing
// translation can't silently fall back to English (overhaul S24.4).
const LOCALES = path.resolve(__dirname, "locales");

// Plural forms differ by language (e.g. `_one`/`_other`), so compare base keys.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix.replace(PLURAL_SUFFIX, "")];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

const load = (lang: string, file: string) =>
  JSON.parse(readFileSync(path.join(LOCALES, lang, file), "utf8")) as unknown;

describe("locale parity", () => {
  const namespaces = readdirSync(path.join(LOCALES, "en")).filter((f) => f.endsWith(".json"));

  it("has the same namespaces in every language", () => {
    expect(
      readdirSync(path.join(LOCALES, "es"))
        .filter((f) => f.endsWith(".json"))
        .sort(),
    ).toEqual([...namespaces].sort());
  });

  it.each(namespaces)("%s has the same keys in en and es", (file) => {
    const en = new Set(keysOf(load("en", file)));
    const es = new Set(keysOf(load("es", file)));
    expect([...en].filter((key) => !es.has(key)).sort(), "missing in es").toEqual([]);
    expect([...es].filter((key) => !en.has(key)).sort(), "missing in en").toEqual([]);
  });
});
