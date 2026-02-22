import { createRootRoute, Outlet } from '@tanstack/react-router';
import React, { Suspense } from 'react';
import { AppInitializer } from '../app/AppInitializer';

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
        <>
            <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
                <AppInitializer>
                    <Outlet />
                </AppInitializer>
            </div>
            <Suspense fallback={null}>
                <TanStackRouterDevtools />
            </Suspense>
        </>
    ),
});
