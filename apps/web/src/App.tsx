import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  calculateDemand,
  getProsperityIndex,
  haversineDistance,
  getSeason,
  fpFormat,
  fp,
  fpScale,
} from '@airtr/core';
import type { Airport, Season, FixedPoint } from '@airtr/core';

import { airports as AIRPORTS } from '@airtr/data';
import { Globe } from '@airtr/map';

interface RouteData {
  origin: Airport;
  destination: Airport;
  distance: number;
  demand: { economy: number; business: number; first: number };
  estimatedDailyRevenue: FixedPoint;
  season: Season;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  source: 'gps' | 'timezone' | 'manual';
}

/**
 * Use the IANA timezone name (e.g. "America/Bogota") to find
 * the best matching airport. This is WAY more precise than UTC offset
 * because Bogotá and New York share UTC-5 but have different IANA names.
 */
function findAirportByTimezone(): Airport | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Exact match on IANA timezone
    const exact = AIRPORTS.find(a => a.timezone === tz);
    if (exact) return exact;

    // Try matching the city part of the timezone (e.g. "Bogota" from "America/Bogota")
    const tzCity = tz.split('/').pop()?.replace(/_/g, ' ').toLowerCase();
    if (tzCity) {
      const cityMatch = AIRPORTS.find(a => a.city.toLowerCase() === tzCity);
      if (cityMatch) return cityMatch;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fallback: estimate location from UTC offset */
function estimateLocationFromOffset(): UserLocation {
  const offsetMinutes = new Date().getTimezoneOffset();
  const longitude = -(offsetMinutes / 60) * 15;
  const latitude = 30; // rough global average
  return { latitude, longitude, source: 'timezone' };
}

/** Find the nearest airport to a given location */
function findNearestAirport(lat: number, lon: number): Airport {
  let nearest = AIRPORTS[0];
  let minDist = Infinity;
  for (const airport of AIRPORTS) {
    const dist = haversineDistance(lat, lon, airport.latitude, airport.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = airport;
    }
  }
  return nearest;
}

/** Generate interesting routes from a home airport */
function generateRoutes(home: Airport, tick: number): RouteData[] {
  const now = new Date();
  const prosperity = getProsperityIndex(tick);

  const others = AIRPORTS
    .filter(a => a.iata !== home.iata)
    .map(a => ({
      airport: a,
      distance: haversineDistance(home.latitude, home.longitude, a.latitude, a.longitude),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Pick: 2 short-haul, 2 medium, 2 long-haul
  const picks: Airport[] = [];
  if (others.length >= 2) picks.push(others[0].airport, others[1].airport);
  const midIdx = Math.floor(others.length * 0.4);
  const midIdx2 = Math.floor(others.length * 0.5);
  if (others.length >= 6) picks.push(others[midIdx].airport, others[midIdx2].airport);
  if (others.length >= 4) picks.push(others[others.length - 2].airport, others[others.length - 1].airport);

  return picks.map(dest => {
    const season = getSeason(dest.latitude, now);
    const distance = haversineDistance(home.latitude, home.longitude, dest.latitude, dest.longitude);
    const demand = calculateDemand(home, dest, season, prosperity);
    const avgFarePerKm = 0.12;
    const baseFare = Math.max(80, Math.round(distance * avgFarePerKm));
    const totalPax = demand.economy + demand.business + demand.first;
    const estimatedDailyRevenue = fpScale(fp(baseFare), totalPax / 7);
    return { origin: home, destination: dest, distance, demand, estimatedDailyRevenue, season };
  });
}

// --- Hub Picker Component ---

function HubPicker({
  currentHub,
  onSelect,
}: {
  currentHub: Airport;
  onSelect: (airport: Airport) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return AIRPORTS;
    const q = search.toLowerCase();
    return AIRPORTS.filter(
      a =>
        a.iata.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    );
  }, [search]);

  if (!open) {
    return (
      <button
        className="hub-change-btn"
        onClick={() => setOpen(true)}
        title="Change your hub airport"
        id="hub-change-btn"
      >
        Change hub
      </button>
    );
  }

  return (
    <>
      <button
        className="hub-change-btn"
        onClick={() => setOpen(true)}
        title="Change your hub airport"
        id="hub-change-btn"
      >
        Change hub
      </button>
      {createPortal(
        <div className="hub-picker-overlay" onClick={() => setOpen(false)}>
          <div className="hub-picker" onClick={e => e.stopPropagation()}>
            <div className="hub-picker-header">
              <h2>Choose Your Hub Airport</h2>
              <button className="hub-picker-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <input
              ref={inputRef}
              className="hub-picker-search"
              type="text"
              placeholder="Search by city, IATA code, or airport name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="hub-search-input"
            />
            <div className="hub-picker-list">
              {filtered.map(airport => (
                <button
                  key={airport.iata}
                  className={`hub-picker-item ${airport.iata === currentHub.iata ? 'active' : ''}`}
                  onClick={() => {
                    onSelect(airport);
                    setOpen(false);
                    setSearch('');
                  }}
                  id={`hub-pick-${airport.iata}`}
                >
                  <span className="hub-picker-iata">{airport.iata}</span>
                  <span className="hub-picker-info">
                    <span className="hub-picker-city">{airport.city}</span>
                    <span className="hub-picker-name">{airport.name}</span>
                  </span>
                  <span className="hub-picker-country">{airport.country}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="hub-picker-empty">No airports match "{search}"</div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// --- Main App ---

function App() {
  const [tick, setTick] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [homeAirport, setHomeAirport] = useState<Airport | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [locationMethod, setLocationMethod] = useState<string>('');

  // Detect user location — try GPS, then IANA timezone, then UTC offset
  useEffect(() => {
    const setHub = (airport: Airport, loc: UserLocation, method: string) => {
      setUserLocation(loc);
      setHomeAirport(airport);
      setRoutes(generateRoutes(airport, 0));
      setLocationMethod(method);
    };

    // Strategy 1: Try GPS
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: UserLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            source: 'gps',
          };
          const home = findNearestAirport(loc.latitude, loc.longitude);
          setHub(home, loc, 'GPS');
        },
        () => {
          // GPS failed — try IANA timezone
          const tzAirport = findAirportByTimezone();
          if (tzAirport) {
            const loc: UserLocation = {
              latitude: tzAirport.latitude,
              longitude: tzAirport.longitude,
              source: 'timezone',
            };
            setHub(tzAirport, loc, `timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
          } else {
            // Last resort: UTC offset
            const loc = estimateLocationFromOffset();
            const home = findNearestAirport(loc.latitude, loc.longitude);
            setHub(home, loc, 'UTC offset (imprecise)');
          }
        },
        { timeout: 3000 },
      );
    } else {
      const tzAirport = findAirportByTimezone();
      if (tzAirport) {
        const loc: UserLocation = {
          latitude: tzAirport.latitude,
          longitude: tzAirport.longitude,
          source: 'timezone',
        };
        setHub(tzAirport, loc, `timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
      } else {
        const loc = estimateLocationFromOffset();
        const home = findNearestAirport(loc.latitude, loc.longitude);
        setHub(home, loc, 'UTC offset');
      }
    }
  }, []);

  // Tick the simulation
  useEffect(() => {
    if (!homeAirport) return;
    const interval = setInterval(() => {
      setTick(t => {
        const next = t + 1;
        setRoutes(generateRoutes(homeAirport, next));
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [homeAirport]);

  // Manual hub change
  const handleHubChange = (airport: Airport | null) => {
    if (!airport) return;
    setHomeAirport(airport);
    setUserLocation({
      latitude: airport.latitude,
      longitude: airport.longitude,
      source: 'manual',
    });
    setLocationMethod('manual selection');
    setRoutes(generateRoutes(airport, tick));
  };

  const prosperity = getProsperityIndex(tick);
  const season = userLocation ? getSeason(userLocation.latitude, new Date()) : 'winter';

  if (!homeAirport || !userLocation) {
    return (
      <div className="app">
        <div className="main-content">
          <div className="hero">
            <h1 className="hero-title">
              <span className="hero-title-accent">Locating you...</span>
            </h1>
            <p className="hero-subtitle">Finding your nearest airport to build your airline.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatPax = (n: number) => n.toLocaleString();
  const formatDist = (km: number) => {
    if (km < 1000) return `${Math.round(km)} km`;
    return `${(km / 1000).toFixed(1)}K km`;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">AirTR</span>
          <span className="header-badge">Phase 0</span>
        </div>
        <div className="header-status">
          <div className="status-dot" />
          <span className="status-text">Engine Live — Tick {tick}</span>
        </div>
      </header>

      <Globe
        airports={AIRPORTS}
        selectedAirport={homeAirport}
        onAirportSelect={handleHubChange}
        className="map-bg"
      />

      <main className="main-content has-map">
        <section className="hero fade-in">
          <h1 className="hero-title">
            Your hub:&nbsp;
            <span className="hero-title-accent">{homeAirport.iata}</span>
          </h1>
          <p className="hero-subtitle">
            {homeAirport.name}, {homeAirport.city}.
            <br />
            Detected via {locationMethod}.
            <br />
            It's <strong>{season}</strong> here — {routes.length} routes computing.
          </p>
          <HubPicker currentHub={homeAirport} onSelect={handleHubChange} />
        </section>

        <section className="engine-demo fade-in fade-in-delay-1">
          <div className="engine-demo-header">
            <div className="engine-demo-dots">
              <div className="engine-demo-dot" />
              <div className="engine-demo-dot" />
              <div className="engine-demo-dot" />
            </div>
            <span className="engine-demo-title">
              @airtr/core — routes from {homeAirport.iata} ({homeAirport.city})
            </span>
          </div>

          <div className="engine-demo-body">
            <div className="route-grid">
              {routes.map((r) => {
                const total = r.demand.economy + r.demand.business + r.demand.first;
                return (
                  <div className="route-card" key={`${r.origin.iata}-${r.destination.iata}`}>
                    <div className="route-card-header">
                      <span className="route-pair">
                        {r.origin.iata}
                        <span className="route-arrow">→</span>
                        {r.destination.iata}
                      </span>
                      <span className="route-distance">{formatDist(r.distance)}</span>
                    </div>
                    <div className="route-stats">
                      <div className="route-stat">
                        <span className="route-stat-label">Weekly Demand</span>
                        <span className="route-stat-value demand">{formatPax(total)} pax</span>
                      </div>
                      <div className="route-stat">
                        <span className="route-stat-label">Econ / Biz / First</span>
                        <span className="route-stat-value">
                          {formatPax(r.demand.economy)} / {formatPax(r.demand.business)} / {formatPax(r.demand.first)}
                        </span>
                      </div>
                      <div className="route-stat">
                        <span className="route-stat-label">Daily Rev (est)</span>
                        <span className="route-stat-value profit">{fpFormat(r.estimatedDailyRevenue, 0)}</span>
                      </div>
                      <div className="route-stat">
                        <span className="route-stat-label">Season @ dest</span>
                        <span className="route-stat-value">{r.season}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ticker">
            <div className="ticker-item">
              <span className="ticker-label">Your Season</span>
              <span className="ticker-value info">{season}</span>
            </div>
            <div className="ticker-item">
              <span className="ticker-label">Prosperity</span>
              <span className={`ticker-value ${prosperity >= 1 ? 'positive' : 'accent'}`}>
                {(prosperity * 100).toFixed(1)}%
              </span>
            </div>
            <div className="ticker-item">
              <span className="ticker-label">Airports</span>
              <span className="ticker-value info">{AIRPORTS.length} loaded</span>
            </div>
            <div className="ticker-item">
              <span className="ticker-label">Hub</span>
              <span className="ticker-value accent">{homeAirport.iata}</span>
            </div>
            <div className="ticker-item">
              <span className="ticker-label">Engine</span>
              <span className="ticker-value positive">deterministic ✓</span>
            </div>
          </div>
        </section>

        <div className="tech-stack fade-in fade-in-delay-2">
          {['TypeScript', 'Vite', 'React 19', 'Vitest', 'pnpm', 'Nostr', 'MapLibre', 'CesiumJS', 'Web Audio'].map(t => (
            <span className="tech-pill" key={t}>{t}</span>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
