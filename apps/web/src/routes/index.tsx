import { createFileRoute } from '@tanstack/react-router';
import { IdentityGate } from '@/features/identity/components/IdentityGate';
import { WorldMap } from '@/features/network/components/WorldMap';
import { Ticker } from '@/features/network/components/Ticker';
import { useAirlineStore, useEngineStore } from '@airtr/store';
import { fpFormat } from '@airtr/core';

export const Route = createFileRoute('/')({
    component: DashboardOverview,
});

function DashboardOverview() {
    return (
        <IdentityGate>
            <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
                {/* Layer 0: The WebGL Map */}
                <WorldMap />

                {/* Layer 1: Floating Dashboard */}
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 pb-12">
                    {/* Top Navbar Area */}
                    <div className="flex w-full items-start justify-between">
                        <AirlineHeader />
                        <div className="flex space-x-4 pointer-events-auto">
                            {/* Future: Fleet, Routes, Corporate Navigation Tabs */}
                        </div>
                    </div>

                    {/* Bottom Data Panels */}
                    <div className="flex justify-between items-end gap-4 pointer-events-auto w-full md:w-auto overflow-x-auto pb-4">
                        <RouteMetricsCard />
                    </div>
                </div>

                {/* Layer 2: The Global Ticker */}
                <Ticker />
            </div>
        </IdentityGate>
    );
}

// Small sub-components for the Dashboard
function AirlineHeader() {
    const { airline } = useAirlineStore();

    if (!airline) return null;

    return (
        <div className="pointer-events-auto flex items-center space-x-4 rounded-xl border border-border/50 bg-background/60 p-4 shadow-xl backdrop-blur-xl">
            <div
                className="flex h-12 w-12 items-center justify-center rounded-lg shadow-inner"
                style={{
                    backgroundColor: airline.livery.primary,
                    color: airline.livery.secondary,
                }}
            >
                <span className="text-lg font-black">{airline.icaoCode}</span>
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{airline.name}</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {airline.callsign} | <span className="text-green-400">{fpFormat(airline.corporateBalance)}</span>
                </p>
            </div>
        </div>
    );
}

function RouteMetricsCard() {
    const routes = useEngineStore((s) => s.routes);
    const homeAirport = useEngineStore((s) => s.homeAirport);

    if (!homeAirport || routes.length === 0) return null;

    return (
        <div className="min-w-[400px] flex flex-col space-y-3 rounded-xl border border-border/50 bg-background/60 p-5 shadow-xl backdrop-blur-xl max-h-[300px] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                    Origin: <span className="text-foreground">{homeAirport.iata}</span>
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">
                    {routes.length} Active Routes
                </span>
            </div>

            <div className="space-y-2">
                {routes.slice(0, 5).map((r) => {
                    const totalDemand = r.demand.economy + r.demand.business + r.demand.first;
                    return (
                        <div key={r.destination.iata} className="flex items-center justify-between text-sm py-1">
                            <div className="flex items-center space-x-3 w-1/3">
                                <span className="font-mono font-medium text-accent">{r.destination.iata}</span>
                                <span className="text-xs text-muted-foreground max-w-[80px] truncate">{r.destination.city}</span>
                            </div>
                            <div className="text-right w-1/3">
                                <span className="text-xs text-muted-foreground block">Weekly Pax</span>
                                <span className="font-mono text-foreground">{totalDemand.toLocaleString()}</span>
                            </div>
                            <div className="text-right w-1/3">
                                <span className="text-xs text-muted-foreground block">Est Daily Rev</span>
                                <span className="font-mono text-green-400">{fpFormat(r.estimatedDailyRevenue, 0)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
