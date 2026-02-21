import { type FormEvent, useState } from 'react';
import { useAirlineStore, useEngineStore } from '@airtr/store';

export function AirlineCreator() {
    const { createAirline, isKeyConfigured, initializeIdentity, isLoading, error } = useAirlineStore();
    const homeAirport = useEngineStore(s => s.homeAirport);
    const [name, setName] = useState('');
    const [icao, setIcao] = useState('');
    const [callsign, setCallsign] = useState('');
    const [primary, setPrimary] = useState('#1a1a2e');
    const [secondary, setSecondary] = useState('#e94560');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!homeAirport) return;

        await createAirline({
            name,
            icaoCode: icao.toUpperCase(),
            callsign: callsign.toUpperCase(),
            hubIata: homeAirport.iata,
            livery: {
                primary,
                secondary,
                accent: '#ffffff'
            }
        });
    };

    if (!isKeyConfigured) {
        return (
            <div className="airline-creator">
                <h2>Welcome to AirTR</h2>
                <p>We need to configure your Nostr identity to store your airline.</p>
                <button onClick={initializeIdentity} disabled={isLoading}>
                    {isLoading ? 'Connecting…' : 'Connect Identity'}
                </button>
                {error && <p className="error">{error}</p>}
            </div>
        );
    }

    return (
        <form className="airline-creator" onSubmit={handleSubmit}>
            <h2>Create Your Airline</h2>
            {error && <p className="error">{error}</p>}

            <label>
                Airline Name
                <input name="airline-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Aurora Airlines" autoComplete="off" spellCheck={false} />
            </label>
            <label>
                ICAO Code (3 Letters)
                <input name="airline-icao" required maxLength={3} value={icao} onChange={e => setIcao(e.target.value)} placeholder="AUR" autoComplete="off" spellCheck={false} />
            </label>
            <label>
                Callsign
                <input name="airline-callsign" required value={callsign} onChange={e => setCallsign(e.target.value)} placeholder="AURORA" autoComplete="off" spellCheck={false} />
            </label>

            <div className="colors">
                <label>
                    Primary Color
                    <input name="primary-color" type="color" value={primary} onChange={e => setPrimary(e.target.value)} />
                </label>
                <label>
                    Secondary Color
                    <input name="secondary-color" type="color" value={secondary} onChange={e => setSecondary(e.target.value)} />
                </label>
            </div>

            <button type="submit" disabled={isLoading}>
                {isLoading ? 'Publishing to Nostr…' : 'Create Airline'}
            </button>
        </form>
    );
}
