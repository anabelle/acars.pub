#!/usr/bin/env node
/**
 * weather-publish.ts — the ACARS weather oracle (S68, D11).
 *
 * Fetches the latest METAR for the world's biggest airports from NOAA
 * (aviationweather.gov, public domain), reduces each to a few factors
 * (flight category, gusts, thunderstorm/fog/snow), and publishes one signed
 * weather bundle for the current UTC hour to the relays. Run it once an hour
 * (cron at HH:02). Clients only accept bundles signed by the configured
 * weather key (VITE_WEATHER_PUBKEY in the web app).
 *
 * Usage (after `pnpm -r --filter "./packages/*" build`):
 *   WEATHER_NSEC=nsec1… pnpm weather:publish [--dry-run] [--airports 500]
 *
 * The private key never leaves this process; only the signed event is sent.
 */
import { parseMetar, type WeatherFactors } from "@acars/core";
import { decode } from "nostr-tools/nip19";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { airports } from "../../data/dist/airports.js";
import { buildWeatherEvent, parseWeatherEvent } from "../src/weatherBundle.ts";

const RELAYS = [
  "wss://nostr.acars.pub",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nos.lol",
];
const METAR_URL = "https://aviationweather.gov/api/data/metar";
const CHUNK = 100;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--airports");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 500;

function secretKey(): Uint8Array {
  const nsec = process.env.WEATHER_NSEC ?? "";
  if (!nsec) {
    if (dryRun) return new Uint8Array(32).fill(1);
    throw new Error("Set WEATHER_NSEC to the weather key (nsec1…).");
  }
  const decoded = decode(nsec);
  if (decoded.type !== "nsec") throw new Error("WEATHER_NSEC is not an nsec.");
  return decoded.data;
}

/** The `limit` biggest airports by metro population, one per city, with ICAO codes. */
function pickAirports(): Map<string, string> {
  const byCity = new Map<string, (typeof airports)[number]>();
  for (const a of airports) {
    if (!/^[A-Z]{4}$/.test(a.icao) || !/^[A-Z]{3}$/.test(a.iata)) continue;
    const key = `${a.country}|${a.city}`;
    const seen = byCity.get(key);
    if (!seen || (a.runwayLengthFt ?? 0) > (seen.runwayLengthFt ?? 0)) byCity.set(key, a);
  }
  const chosen = [...byCity.values()].sort((a, b) => b.population - a.population).slice(0, limit);
  return new Map(chosen.map((a) => [a.icao, a.iata]));
}

async function fetchMetars(icaos: string[]): Promise<Map<string, string>> {
  const raw = new Map<string, string>();
  for (let i = 0; i < icaos.length; i += CHUNK) {
    const ids = icaos.slice(i, i + CHUNK).join(",");
    const response = await fetch(`${METAR_URL}?ids=${ids}&format=raw&hours=2`, {
      headers: { "User-Agent": "acars.pub weather oracle" },
    });
    if (!response.ok) throw new Error(`NOAA ${response.status} for ${ids.slice(0, 40)}…`);
    for (const line of (await response.text()).split("\n")) {
      const report = line.trim().replace(/^(METAR|SPECI)\s+/, "");
      const icao = report.slice(0, 4);
      // Newest first: keep the first report per station.
      if (/^[A-Z]{4}$/.test(icao) && !raw.has(icao)) raw.set(icao, report);
    }
  }
  return raw;
}

function publish(url: string, event: object): Promise<string> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const done = (result: string) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      resolve(`${url}: ${result}`);
    };
    const timer = setTimeout(() => done("timeout"), 10_000);
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
    ws.onmessage = (message) => {
      const data = JSON.parse(String(message.data));
      if (data[0] === "OK") done(data[2] ? "ok" : `rejected (${data[3]})`);
    };
    ws.onerror = () => done("error");
  });
}

async function main() {
  const sk = secretKey();
  const pubkey = getPublicKey(sk);
  const chosen = pickAirports();
  const reports = await fetchMetars([...chosen.keys()]);
  const factors = new Map<string, WeatherFactors>();
  for (const [icao, report] of reports) {
    const iata = chosen.get(icao);
    if (iata) factors.set(iata, parseMetar(report));
  }
  const unsigned = buildWeatherEvent({ issuedAtMs: Date.now(), airports: factors });
  const event = finalizeEvent(unsigned, sk);
  // Check our own output exactly as clients will.
  const check = parseWeatherEvent(event, pubkey);
  if (!check || check.airports.size !== factors.size) throw new Error("Bundle failed validation.");
  const notCalm = [...factors.values()].filter(
    (f) => f.category > 0 || f.thunderstorm || f.snow || f.gustKt > 35,
  );
  console.log(
    `Weather ${check.hourKey}: ${factors.size}/${chosen.size} airports, ${notCalm.length} not calm, ${event.content.length} bytes, key ${pubkey}`,
  );
  if (dryRun) return;
  for (const result of await Promise.all(RELAYS.map((url) => publish(url, event)))) {
    console.log(result);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
