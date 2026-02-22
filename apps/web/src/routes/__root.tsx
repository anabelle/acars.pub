import { createRootRoute, Outlet } from '@tanstack/react-router';
import React, { Suspense } from 'react';
import { AppInitializer } from '../app/AppInitializer';
import { IdentityGate } from '@/features/identity/components/IdentityGate';
import { WorldMap } from '@/features/network/components/WorldMap';
import { Ticker } from '@/features/network/components/Ticker';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Topbar } from '@/shared/components/layout/Topbar';

const TanStackRouterDevtools =
    process.env.NODE_ENV === 'production'
        ? () => null
        : React.lazy(() =>
            import('@tanstack/router-devtools').then((res) => ({
                default: res.TanStackRouterDevtools,
            })),
        );

export const Route = createRootRoute({
    component: () => (
        <AppInitializer>
            <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground">
                {/* Layer 0: The WebGL Map (Always rendering in background) */}
                <WorldMap />

                {/* Layer 1: the Tycoon HUD Shell (Overlaying the Map) */}
                <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">
                    <IdentityGate>
                        {/* Shell is only visible when Identity is fully established */}
                        <div className="flex h-full w-full flex-col">
                            <Topbar />

                            <div className="flex flex-1 overflow-hidden relative pb-10">
                                <Sidebar />

                                {/* The main content area where domain views slide in.
                    We give it padding and pointer-events-auto so the panels are interactive, 
                    but the background remains transparent and un-clickable so the map below can be dragged if there is space. */}
                                <main className="relative flex-1 p-6 h-full overflow-hidden pointer-events-none">
                                    {/* Context Panel wrapper for domain views */}
                                    <div className="h-full w-full max-w-2xl pointer-events-auto bg-background/85 border border-border rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl flex flex-col overflow-hidden">
                                        <Outlet />
                                    </div>
                                </main>
                            </div>

                        </div>
                    </IdentityGate>
                </div>

                {/* Layer 2: The Global Edge Ticker (Always rendering) */}
                <Ticker />

                <Suspense fallback={null}>
                    <TanStackRouterDevtools position="bottom-right" />
                </Suspense>
            </div>
        </AppInitializer>
    ),
});
