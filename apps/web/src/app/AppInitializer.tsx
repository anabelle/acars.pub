import type { Airport } from "@acars/core";
import {
  findPreferredHub,
  getAirports,
  isDataCatalogReady,
  whenDataCatalogReady,
} from "@acars/data";
import type { UserLocation } from "@acars/store";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useEffect, useRef, useState } from "react";

/**
 * Message contract posted by the auditor worker (src/workers/auditor.ts).
 * Kept inline (rather than imported from the worker) so this bootstrap does
 * not depend on the worker module's export surface.
 */
type AuditorCycleMessage = {
  type: "audit-cycle";
  pubkey?: string;
  status?: "ok" | "failed";
  failedCount?: number;
  reason?: string;
};

/** Fallback: estimate location from UTC offset */
function estimateLocationFromOffset(): UserLocation {
  const offsetMinutes = new Date().getTimezoneOffset();
  const longitude = -(offsetMinutes / 60) * 15;
  const latitude = 30; // rough global average
  return { latitude, longitude, source: "timezone" };
}

/** IANA timezone detection */
function findAirportByTimezone(occupiedIatas?: ReadonlySet<string>): Airport | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const AIRPORTS = getAirports();
    const matches = AIRPORTS.filter((a) => a.timezone === tz);
    if (matches.length > 0) {
      const sorted = [...matches].sort((a, b) => (b.population || 0) - (a.population || 0));
      const available = occupiedIatas ? sorted.find((a) => !occupiedIatas.has(a.iata)) : sorted[0];
      if (available) return available;
      // All timezone matches occupied — fall through to city match
    }

    const tzCity = tz.split("/").pop()?.replace(/_/g, " ").toLowerCase();
    if (tzCity) {
      const cityMatches = AIRPORTS.filter((a) => a.city.toLowerCase() === tzCity);
      if (cityMatches.length > 0) {
        const sorted = [...cityMatches].sort((a, b) => (b.population || 0) - (a.population || 0));
        const available = occupiedIatas
          ? sorted.find((a) => !occupiedIatas.has(a.iata))
          : sorted[0];
        if (available) return available;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Collect all IATA codes used as hubs by competitor airlines. */
function collectOccupiedHubs(
  competitors: ReadonlyMap<string, { hubs: readonly string[] }>,
): Set<string> {
  const occupied = new Set<string>();
  competitors.forEach((airline) => {
    for (const hub of airline.hubs) {
      occupied.add(hub);
    }
  });
  return occupied;
}

export function AppInitializer({ children }: { children: React.ReactNode }) {
  // Primitive-granularity subscriptions: selecting the whole `airline` object
  // re-rendered this wrapper (and re-fired its effects) on every tick because
  // the store replaces the airline identity as balances change.
  const primaryHubIata = useAirlineStore((s) => s.airline?.hubs?.[0] ?? null);
  const hasAirline = useAirlineStore((s) => Boolean(s.airline));
  const initializeIdentity = useAirlineStore((s) => s.initializeIdentity);
  const identityStatus = useAirlineStore((s) => s.identityStatus);
  const competitors = useAirlineStore((s) => s.competitors);
  const homeAirport = useEngineStore((s) => s.homeAirport);
  const userLocation = useEngineStore((s) => s.userLocation);
  const setHub = useEngineStore((s) => s.setHub);
  const startEngine = useEngineStore((s) => s.startEngine);

  // Track whether the user has manually picked a hub via HubPicker.
  // When they do, we must not override their choice.
  const userManuallyPickedHub = useRef(false);

  // Async airports catalog (~6k entries) — kick the load off immediately on
  // mount, BEFORE identity init / startEngine, so the hub-selection and
  // engine-start effects below never race the catalog. First paint is not
  // blocked: the map/UI render shells until `catalogReady` flips.
  const [catalogReady, setCatalogReady] = useState(isDataCatalogReady);
  // No synchronous setState branch here: if the catalog became ready between
  // render and effect, whenDataCatalogReady() resolves in a microtask and the
  // .then callback (async, not sync-in-effect) flips the flag identically.
  useEffect(() => {
    let cancelled = false;
    void whenDataCatalogReady().then(() => {
      if (!cancelled) setCatalogReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isHubSelectionLocked = () =>
    userManuallyPickedHub.current || useEngineStore.getState().userLocation?.source === "manual";

  // TAREA 8: background peer-audit worker. Created imperatively so the effect
  // is idempotent under StrictMode double-mount — cleanup terminates the
  // worker, and a fresh one is created on remount (no shared mutable state).
  // Deferred ~10s so the worker's first audit cycle (snapshot fetches +
  // decompression + hashing) does not compete with startup: identity load,
  // catalog fetch and first map paint own the CPU early on.
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let auditorWorker: Worker | null = null;
    const spawnTimer = window.setTimeout(() => {
      auditorWorker = new Worker(new URL("../workers/auditor.ts", import.meta.url), {
        type: "module",
      });
      auditorWorker.onmessage = (event: MessageEvent<AuditorCycleMessage>) => {
        const payload = event.data;
        if (payload?.type === "audit-cycle" && payload.status === "failed") {
          console.warn("[auditor] audit cycle failed", {
            pubkey: payload.pubkey,
            failedCount: payload.failedCount,
            reason: payload.reason,
          });
        }
      };
      auditorWorker.postMessage({ type: "start" });
    }, 10_000);
    return () => {
      window.clearTimeout(spawnTimer);
      if (auditorWorker) {
        auditorWorker.onmessage = null;
        auditorWorker.terminate();
      }
    };
  }, []);

  useEffect(() => {
    void initializeIdentity();
  }, [initializeIdentity]);

  useEffect(() => {
    if (userLocation?.source === "manual") {
      userManuallyPickedHub.current = true;
    }
  }, [userLocation]);

  // Once airline loads from Nostr, authoritatively set engine hub to hubs[0].
  // This takes priority over any geo-detection that may have run first.
  // Dep is the primitive hub IATA — the airline object identity changes every
  // tick, which used to re-fire this effect on each of them.
  useEffect(() => {
    if (!primaryHubIata) return;
    if (!catalogReady) return; // airports catalog still loading — wait
    const dbHub = getAirports().find((a) => a.iata === primaryHubIata);
    if (dbHub) {
      setHub(
        dbHub,
        { latitude: dbHub.latitude, longitude: dbHub.longitude, source: "manual" },
        "nostr profile",
      );
    }
    startEngine();
  }, [primaryHubIata, catalogReady, setHub, startEngine]);

  // Initialize hub from geolocation — only for new users (no airline loaded yet).
  // Wait until identity check has completed so we know if a Nostr profile exists.
  useEffect(() => {
    if (homeAirport) return; // Already initialized
    if (identityStatus === "checking") return; // Identity still loading — wait
    if (hasAirline) return; // Returning user — Nostr sync effect handles hub
    if (!catalogReady) return; // Airports catalog still loading — wait

    const fallbackLocate = () => {
      // Guard: airline may have loaded while geo was pending
      if (useAirlineStore.getState().airline) return;
      if (isHubSelectionLocked()) {
        startEngine();
        return;
      }

      const tzAirport = findAirportByTimezone(
        competitors.size > 0 ? collectOccupiedHubs(competitors) : undefined,
      );
      if (tzAirport) {
        const loc: UserLocation = {
          latitude: tzAirport.latitude,
          longitude: tzAirport.longitude,
          source: "timezone",
        };
        setHub(tzAirport, loc, `timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
      } else {
        const loc = estimateLocationFromOffset();
        const home = findPreferredHub(loc.latitude, loc.longitude);
        setHub(home, loc, "UTC offset");
      }
      startEngine();
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Guard: airline may have loaded while geo was pending
          if (useAirlineStore.getState().airline) return;
          if (isHubSelectionLocked()) {
            startEngine();
            return;
          }

          const loc: UserLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            source: "gps",
          };
          const home = findPreferredHub(loc.latitude, loc.longitude);
          setHub(home, loc, "GPS");
          startEngine();
        },
        fallbackLocate,
        { timeout: 3000 },
      );
    } else {
      fallbackLocate();
    }
  }, [homeAirport, identityStatus, hasAirline, catalogReady, competitors, setHub, startEngine]);

  // Re-evaluate the suggested hub once competitor data loads from Nostr.
  // This only fires for new users who haven't created an airline yet and
  // haven't manually selected a hub via the HubPicker.
  useEffect(() => {
    if (hasAirline) return; // Returning user — don't touch their hub
    if (competitors.size === 0) return; // No competitor data yet
    if (!userLocation || !homeAirport) return;
    if (!catalogReady) return; // findPreferredHub needs the airports catalog

    // Check if the user manually picked a hub (source === "manual")
    if (userLocation.source === "manual") {
      userManuallyPickedHub.current = true;
      return;
    }
    if (userManuallyPickedHub.current) return;

    const occupied = collectOccupiedHubs(competitors);
    if (occupied.size === 0) return;
    if (!occupied.has(homeAirport.iata)) return; // Current suggestion is fine

    // Re-run hub suggestion with competitor awareness
    const { latitude, longitude } = userLocation;
    const better = findPreferredHub(latitude, longitude, undefined, occupied);
    if (better.iata !== homeAirport.iata) {
      setHub(better, { latitude, longitude, source: userLocation.source }, "auto-distributed");
    }
  }, [hasAirline, competitors, homeAirport, userLocation, catalogReady, setHub]);

  return <>{children}</>;
}
