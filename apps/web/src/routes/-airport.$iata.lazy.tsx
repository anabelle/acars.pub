import type { Airport } from "@acars/core";
import { getAirports } from "@acars/data";
import { useEngineStore } from "@acars/store";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

// Built lazily — the airports catalog loads async after first paint.
let airportIndex: Map<string, Airport> | null = null;
function getAirportIndex(): Map<string, Airport> {
  if (!airportIndex) {
    airportIndex = new Map<string, Airport>(getAirports().map((a) => [a.iata, a]));
  }
  return airportIndex;
}

export default function AirportPermalinkPage() {
  const { iata } = useParams({ strict: false }) as { iata: string };
  const navigate = useNavigate();
  const setPermalinkAirport = useEngineStore((s) => s.setPermalinkAirport);

  const normalizedIata = iata?.toUpperCase() ?? "";
  const airport = getAirportIndex().get(normalizedIata) ?? null;

  useEffect(() => {
    if (!airport) {
      navigate({ to: "/" });
      return;
    }

    setPermalinkAirport(normalizedIata);

    return () => {
      setPermalinkAirport(null);
    };
  }, [airport, normalizedIata, setPermalinkAirport, navigate]);

  if (!airport) {
    return null;
  }

  return null;
}
