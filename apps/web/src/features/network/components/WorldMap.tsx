import { Globe as CoreGlobe } from '@airtr/map';
import { useEngineStore, useAirlineStore } from '@airtr/store';
import { airports as AIRPORTS } from '@airtr/data';
import type { Airport } from '@airtr/core';

export function WorldMap() {
    const homeAirport = useEngineStore(s => s.homeAirport);
    const setHub = useEngineStore(s => s.setHub);
    const { airline, updateHub } = useAirlineStore();

    const handleHubChange = (airport: Airport | null) => {
        if (!airport) return;
        setHub(
            airport,
            { latitude: airport.latitude, longitude: airport.longitude, source: 'manual' },
            'manual selection'
        );
        // If airline exists, persist hub change to Nostr
        if (airline) {
            updateHub(airport.iata);
        }
    };

    if (!homeAirport) return null;

    return (
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black">
            <CoreGlobe
                airports={AIRPORTS}
                selectedAirport={homeAirport}
                onAirportSelect={handleHubChange}
            />
            {/* Map vignette overlay */}
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-10" />
        </div>
    );
}
