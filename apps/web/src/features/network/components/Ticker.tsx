import { useEngineStore } from '@airtr/store';
import { airports as AIRPORTS } from '@airtr/data';
import { getProsperityIndex } from '@airtr/core';

export function Ticker() {
    const season = useEngineStore((s) => s.routes.length > 0 ? s.routes[0]?.season : 'winter');
    const tick = useEngineStore((s) => s.tick);
    const homeAirport = useEngineStore((s) => s.homeAirport);

    const prosperity = getProsperityIndex(tick);

    if (!homeAirport) return null;

    return (
        <div className="flex items-center space-x-6 overflow-hidden bg-background/95 backdrop-blur-sm border-t border-border px-4 py-1.5 text-xs font-mono text-muted-foreground z-50 fixed bottom-0 left-0 right-0 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
            <div className="flex animate-pulse items-center space-x-2 text-primary">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_5px_currentColor]"></div>
                <span className="font-semibold uppercase tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center space-x-2 border-r border-border pr-6">
                <span>TICK</span>
                <span className="text-foreground">{tick}</span>
            </div>
            <div className="flex items-center space-x-2 border-r border-border pr-6">
                <span>HUB</span>
                <span className="text-accent">{homeAirport.iata}</span>
            </div>
            <div className="flex items-center space-x-2 border-r border-border pr-6">
                <span>SEASON</span>
                <span className="text-info text-blue-400 capitalize">{season}</span>
            </div>
            <div className="flex items-center space-x-2 border-r border-border pr-6">
                <span>G-PROSIdx</span>
                <span className={`font-semibold ${prosperity >= 1 ? 'text-green-500' : 'text-orange-400'}`}>
                    {(prosperity * 100).toFixed(1)}%
                </span>
            </div>
            <div className="flex items-center space-x-2 border-r border-border pr-6">
                <span>AIRPORTS</span>
                <span className="text-foreground">{AIRPORTS.length} DB</span>
            </div>
            <div className="flex items-center space-x-2">
                <span>ENGINE</span>
                <span className="text-green-500">DETERMINISTIC_OK</span>
            </div>
        </div>
    );
}
