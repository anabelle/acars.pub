import type { Airport } from "@acars/core";
import { fp, fpFormat } from "@acars/core";
import { findPreferredHub, getHubPricingForIata, suggestStarterHubs } from "@acars/data";
import { useAirlineStore, useEngineStore } from "@acars/store";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  selectedIata: string | null;
  onSelect: (airport: Airport) => void;
};

/**
 * Three hubs a new player can start from with one click (S21): the big market
 * near them, the closest airport and the cheapest hub to run, each with its
 * setup and monthly cost. Computed from the player's location, so the list
 * stays put while they click between options.
 */
export function StarterHubChoices({ selectedIata, onSelect }: Props) {
  const { t } = useTranslation(["identity"]);
  const userLocation = useEngineStore((s) => s.userLocation);
  const competitors = useAirlineStore((s) => s.competitors);
  // Picking a hub moves the stored location to it; keep the suggestions
  // anchored to where the player first was so the cards don't reshuffle.
  const [anchor, setAnchor] = useState<{ latitude: number; longitude: number } | null>(null);
  if (!anchor && userLocation) {
    setAnchor({ latitude: userLocation.latitude, longitude: userLocation.longitude });
  }

  const suggestions = useMemo(() => {
    if (!anchor) return [];
    const occupied = new Set<string>();
    for (const airline of competitors.values()) for (const hub of airline.hubs) occupied.add(hub);
    const preferred = findPreferredHub(anchor.latitude, anchor.longitude, undefined, occupied);
    return suggestStarterHubs(anchor.latitude, anchor.longitude, preferred, undefined, occupied);
  }, [anchor, competitors]);

  if (suggestions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="starter-hubs">
      {suggestions.map(({ airport, reason }) => {
        const pricing = getHubPricingForIata(airport.iata);
        const selected = airport.iata === selectedIata;
        return (
          <button
            key={airport.iata}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(airport)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              selected
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t(`creator.hubReason.${reason}`)}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-lg font-black">{airport.iata}</span>
              <span className="truncate text-sm font-medium">{airport.city}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("creator.hubCost", {
                setup: fpFormat(fp(pricing.openFee), 0),
                monthly: fpFormat(fp(pricing.monthlyOpex), 0),
              })}
            </p>
          </button>
        );
      })}
    </div>
  );
}
