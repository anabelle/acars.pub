import { Globe as CoreGlobe } from '@airtr/map';
import { useEngineStore, useAirlineStore } from '@airtr/store';
import { airports as AIRPORTS } from '@airtr/data';
import { useMemo } from 'react';
import type { Airport } from '@airtr/core';

export function WorldMap() {
    const homeAirport = useEngineStore(s => s.homeAirport);
    const tick = useEngineStore(s => s.tick);
    const tickProgress = useEngineStore(s => s.tickProgress);
    const { airline, modifyHubs, fleet, globalFleet, globalRoutes } = useAirlineStore();

    const handleHubChange = (airport: Airport | null) => {
        if (!airport) return;
        if (airline) {
            // modifyHubs atomically syncs engine homeAirport
            modifyHubs({ type: 'switch', iata: airport.iata });
        } else {
            // No airline yet — just move the engine hub for exploration
            const setHub = useEngineStore.getState().setHub;
            setHub(
                airport,
                { latitude: airport.latitude, longitude: airport.longitude, source: 'manual' },
                'manual selection'
            );
        }
    };

    const fleetBaseCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        fleet.forEach((ac) => {
            if (ac.baseAirportIata && ac.status !== 'enroute' && ac.status !== 'delivery') {
                counts[ac.baseAirportIata] = (counts[ac.baseAirportIata] || 0) + 1;
            }
        });
        return counts;
    }, [fleet]);

    if (!homeAirport) return null;

    return (
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-black">
            <CoreGlobe
                airports={AIRPORTS}
                selectedAirport={homeAirport}
                onAirportSelect={handleHubChange}
                fleetBaseCounts={fleetBaseCounts}
                fleet={fleet}
                globalFleet={globalFleet}
                globalRoutes={globalRoutes}
                tick={tick}
                tickProgress={tickProgress}
            />
            {/* Map vignette overlay */}
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-10" />
        </div>
    );
}
