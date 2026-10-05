import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setAirportsCatalog } from "@acars/data";
import { airports } from "@acars/data/airports";
import { it } from "vitest";
import { generateBalanceReport } from "./report.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * `pnpm balance` writes docs/overhaul/balance/latest.md; set BALANCE_OUT
 * (relative to the repo root) to write elsewhere, e.g. a new baseline.
 */
it("writes the balance report", () => {
  setAirportsCatalog(airports);
  const target = resolve(repoRoot, process.env.BALANCE_OUT ?? "docs/overhaul/balance/latest.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generateBalanceReport());
  console.log(`Balance report written to ${target}`);
});
