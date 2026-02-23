import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { getNDK, ensureConnected } from './ndk.js';
import { type AirlineEntity, fp } from '@airtr/core';

export type AirlineConfig = Pick<AirlineEntity, 'name' | 'icaoCode' | 'callsign' | 'hubs' | 'livery' | 'lastTick'> & {
    corporateBalance?: import('@airtr/core').FixedPoint;
    fleet?: import('@airtr/core').AircraftInstance[];
};

const AIRLINE_KIND = 30078;
const AIRLINE_D_TAG = 'airtr:airline';

/**
 * Publishes an airline creation or update event to Nostr.
 */
export async function publishAirline(airline: AirlineConfig): Promise<NDKEvent> {
    ensureConnected();
    const ndk = getNDK();

    if (!ndk.signer) {
        throw new Error("No signer available. Call attachSigner() first.");
    }

    const event = new NDKEvent(ndk);
    event.kind = AIRLINE_KIND;
    event.tags = [['d', AIRLINE_D_TAG]];

    event.content = JSON.stringify({
        name: airline.name,
        icaoCode: airline.icaoCode,
        callsign: airline.callsign,
        hubs: airline.hubs,
        livery: airline.livery,
        corporateBalance: airline.corporateBalance,
        fleet: airline.fleet,
        lastTick: airline.lastTick,
    });

    await event.publish();
    return event;
}

/**
 * Tries to fetch an existing airline configuration for the given pubkey.
 */
export async function loadAirline(pubkey: string): Promise<{ airline: AirlineEntity, fleet: import('@airtr/core').AircraftInstance[] } | null> {
    ensureConnected();
    const ndk = getNDK();

    const filter: NDKFilter = {
        authors: [pubkey],
        kinds: [AIRLINE_KIND],
        '#d': [AIRLINE_D_TAG],
        limit: 1,
    };

    let event: NDKEvent | null = null;
    try {
        event = await Promise.race([
            ndk.fetchEvent(filter),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
    } catch {
        return null;
    }

    if (!event) return null;

    try {
        const data = JSON.parse(event.content);

        // Map event payload to AirlineEntity
        const loaded: AirlineEntity = {
            id: event.id,
            foundedBy: event.author.pubkey,
            status: 'private',
            ceoPubkey: event.author.pubkey,
            sharesOutstanding: 10000000,
            shareholders: { [event.author.pubkey]: 10000000 },
            name: data.name,
            icaoCode: data.icaoCode || data.icao,
            callsign: data.callsign,
            hubs: data.hubs || (data.hubIata ? [data.hubIata] : []), // Migration fallback
            livery: data.livery,
            brandScore: 0.5,
            tier: 1,
            // Defaults for derived metrics
            corporateBalance: data.corporateBalance || fp(100000000),
            stockPrice: fp(10), // $10/share
            fleetIds: data.fleet ? data.fleet.map((f: any) => f.id) : [],
            routeIds: [],
            lastTick: data.lastTick || 0
        };
        return { airline: loaded, fleet: data.fleet || [] };
    } catch (e) {
        console.error("Failed parsing airline Nostr event", e);
        return null;
    }
}
